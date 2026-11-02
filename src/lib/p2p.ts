import * as Y from "yjs";
import { decryptBytes, encryptBytes, fromB64, importRawKey } from "./crypto";

import { RELAYS, relayChannel } from "./relay-channel";

/** Well-known Nostr relays used for discovery. If a direct WebRTC link can't
 *  be made, the same encrypted payloads flow through them (relay-channel.ts). */
const NET = {
  relayConfig: { urls: RELAYS, redundancy: 5, warnOnRelayFailure: false },
};
const selfId = () => [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, "0")).join("");

/**
 * Live sync of a folder's Y.Doc between peers. Direct WebRTC when possible,
 * plus an always-on encrypted relay fallback so strict networks still sync.
 * Every payload is AES-GCM encrypted with the share key.
 * Message types: 0 = state vector (reply with diff), 1 = update, 3 = ping.
 */
export async function connectRoom(doc: Y.Doc, roomId: string, keyB64: string, onPeers: (n: number) => void) {
  const { joinRoom } = await import("trystero/nostr");
  const key = await importRawKey(fromB64(keyB64));
  const room = joinRoom({ ...NET, appId: "nullnote-v1", password: keyB64 } as never, roomId, {
    onJoinError: (e) => console.warn("p2p join error", e.error),
  });
  const me = selfId();
  const relayPeers = new Map<string, number>();
  let closed = false;

  const pack = async (type: number, payload: Uint8Array) => {
    const msg = new Uint8Array(payload.length + 1);
    msg[0] = type;
    msg.set(payload, 1);
    return encryptBytes(key, msg);
  };

  const count = () => {
    const now = Date.now();
    for (const [k, t] of relayPeers) if (now - t > 50_000) relayPeers.delete(k);
    onPeers(Math.max(Object.keys(room.getPeers()).length, relayPeers.size));
  };

  const action = room.makeAction("y", {
    onMessage: async (data, { peerId }) => {
      try {
        const raw = await decryptBytes(key, new Uint8Array(data as ArrayBuffer));
        const body = raw.slice(1);
        if (raw[0] === 0) await action.send(await pack(1, Y.encodeStateAsUpdate(doc, body)), { target: peerId });
        else if (raw[0] === 1) Y.applyUpdate(doc, body, "remote");
      } catch (e) {
        console.warn("p2p message rejected", e);
      }
    },
  });

  const relay = await relayChannel("y:" + roomId, me, async ({ from, data }) => {
    try {
      const raw = await decryptBytes(key, data);
      const isNew = !relayPeers.has(from);
      relayPeers.set(from, Date.now());
      count();
      const body = raw.slice(1);
      if (raw[0] === 0) {
        await relay.send(await pack(1, Y.encodeStateAsUpdate(doc, body)), from);
        if (isNew) await relay.send(await pack(0, Y.encodeStateVector(doc)), from);
      } else if (raw[0] === 1) {
        Y.applyUpdate(doc, body, "remote");
      } else if (raw[0] === 3 && isNew) {
        await relay.send(await pack(0, Y.encodeStateVector(doc)), from);
      }
    } catch { /* not for us / wrong key */ }
  });
  void relay.send(await pack(0, Y.encodeStateVector(doc)));
  const ping = setInterval(async () => { if (!closed) { count(); void relay.send(await pack(3, new Uint8Array())); } }, 20_000);

  room.onPeerJoin = async (peerId) => {
    count();
    void action.send(await pack(0, Y.encodeStateVector(doc)), { target: peerId });
  };
  room.onPeerLeave = count;

  // Batch local edits for the relay path (relays rate-limit chatty clients).
  let pending: Uint8Array[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = async () => {
    timer = null;
    const u = pending.length === 1 ? pending[0]! : Y.mergeUpdates(pending);
    pending = [];
    if (relayPeers.size) await relay.send(await pack(1, u));
  };
  const onUpdate = async (u: Uint8Array, origin: unknown) => {
    if (origin === "remote" || origin === "load") return;
    if (Object.keys(room.getPeers()).length) void action.send(await pack(1, u));
    pending.push(u);
    timer ??= setTimeout(() => void flush(), 400);
  };
  doc.on("update", onUpdate);

  return () => {
    closed = true;
    clearInterval(ping);
    if (timer) { clearTimeout(timer); void flush(); }
    doc.off("update", onUpdate);
    relay.close();
    void room.leave();
  };
}

/* ---------- Device pairing with a short typed code ---------- */
type Share = { room: string; key: string };
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newPairCode() {
  const b = crypto.getRandomValues(new Uint8Array(12));
  const s = [...b].map((x) => ALPHA[x % 32]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}
const norm = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");

async function pairRoom(code: string) {
  const c = norm(code);
  const { deriveKey } = await import("./crypto");
  const key = await deriveKey(c, new TextEncoder().encode("nullnote-pair-v1"));
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("room:" + c)));
  const roomId = [...h.slice(0, 16)].map((x) => x.toString(16).padStart(2, "0")).join("");
  const { joinRoom } = await import("trystero/nostr");
  const room = joinRoom({ ...NET, appId: "nullnote-pair-v1", password: c } as never, roomId);
  return { key, room, roomId };
}

/** Host: hands every folder share to any device that types the code. */
export async function hostPairing(code: string, getShares: () => Promise<Share[]>, onPaired: () => void) {
  const { key, room, roomId } = await pairRoom(code);
  const action = room.makeAction("pair");
  const shares = async () => encryptBytes(key, new TextEncoder().encode(JSON.stringify(await getShares())));
  const done = new Set<string>();
  room.onPeerJoin = async (peerId) => {
    await action.send(await shares(), { target: peerId });
    onPaired();
  };
  // Relay fallback: answer any device that proves it knows the code.
  const relay = await relayChannel("pair:" + roomId, selfId(), async ({ from, data }) => {
    try {
      const hi = new TextDecoder().decode(await decryptBytes(key, data));
      if (hi !== "hi" || done.has(from)) return;
      done.add(from);
      await relay.send(await shares(), from);
      onPaired();
    } catch { /* wrong code */ }
  });
  return () => { relay.close(); void room.leave(); };
}

/** Joiner: waits for the host's folder list. */
export async function joinPairing(code: string, timeoutMs = 60_000): Promise<Share[]> {
  const { key, room, roomId } = await pairRoom(code);
  const action = room.makeAction("pair");
  let finished = false;
  let relay: Awaited<ReturnType<typeof relayChannel>> | null = null;
  let hi: ReturnType<typeof setInterval> | null = null;
  return new Promise((resolve, reject) => {
    const end = () => { finished = true; clearTimeout(t); if (hi) clearInterval(hi); relay?.close(); void room.leave(); };
    const t = setTimeout(() => { end(); reject(new Error("No device found with that code.")); }, timeoutMs);
    const accept = async (data: Uint8Array) => {
      if (finished) return;
      try {
        const list = JSON.parse(new TextDecoder().decode(await decryptBytes(key, data)));
        if (!Array.isArray(list)) return;
        end();
        resolve(list);
      } catch { /* wrong code or noise */ }
    };
    action.onMessage = (data) => void accept(new Uint8Array(data as ArrayBuffer));
    void relayChannel("pair:" + roomId, selfId(), ({ data }) => void accept(data)).then(async (r) => {
      if (finished) return r.close();
      relay = r;
      const sayHi = async () => r.send(await encryptBytes(key, new TextEncoder().encode("hi")));
      void sayHi();
      hi = setInterval(() => void sayHi(), 4000);
    });
  });
}

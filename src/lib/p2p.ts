import * as Y from "yjs";
import { decryptBytes, encryptBytes, fromB64, importRawKey } from "./crypto";

/**
 * Live sync of a folder's Y.Doc directly between peers (WebRTC).
 * Public Nostr relays are used only so peers can find each other; every
 * payload is additionally AES-GCM encrypted with the share key, so relays
 * and anyone without the link see nothing.
 */
export async function connectRoom(doc: Y.Doc, roomId: string, keyB64: string, onPeers: (n: number) => void) {
  const { joinRoom } = await import("trystero/nostr");
  const key = await importRawKey(fromB64(keyB64));
  const room = joinRoom({ appId: "nullnote-v1", password: keyB64 }, roomId, {
    onJoinError: (e) => console.warn("p2p join error", e.error),
  });

  const send = async (type: number, payload: Uint8Array, target?: string) => {
    const msg = new Uint8Array(payload.length + 1);
    msg[0] = type;
    msg.set(payload, 1);
    await action.send(await encryptBytes(key, msg), target ? { target } : undefined);
  };

  const action = room.makeAction("y", {
    onMessage: async (data, { peerId }) => {
      try {
        const raw = await decryptBytes(key, new Uint8Array(data as ArrayBuffer));
        const body = raw.slice(1);
        if (raw[0] === 0) {
          // peer sent its state vector -> reply with what it is missing
          await send(1, Y.encodeStateAsUpdate(doc, body), peerId);
        } else {
          Y.applyUpdate(doc, body, "remote");
        }
      } catch (e) {
        console.warn("p2p message rejected", e);
      }
    },
  });

  const count = () => onPeers(Object.keys(room.getPeers()).length);
  room.onPeerJoin = (peerId) => {
    count();
    void send(0, Y.encodeStateVector(doc), peerId);
  };
  room.onPeerLeave = count;

  const onUpdate = (u: Uint8Array, origin: unknown) => {
    if (origin === "remote" || origin === "load") return;
    if (Object.keys(room.getPeers()).length) void send(1, u);
  };
  doc.on("update", onUpdate);

  return () => {
    doc.off("update", onUpdate);
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
  const room = joinRoom({ appId: "nullnote-pair-v1", password: c }, roomId);
  return { key, room };
}

/** Host: hands every folder share to any device that types the code. */
export async function hostPairing(code: string, getShares: () => Promise<Share[]>, onPaired: () => void) {
  const { key, room } = await pairRoom(code);
  const action = room.makeAction("pair");
  room.onPeerJoin = async (peerId) => {
    const payload = new TextEncoder().encode(JSON.stringify(await getShares()));
    await action.send(await encryptBytes(key, payload), { target: peerId });
    onPaired();
  };
  return () => void room.leave();
}

/** Joiner: waits for the host's folder list. */
export async function joinPairing(code: string, timeoutMs = 60_000): Promise<Share[]> {
  const { key, room } = await pairRoom(code);
  const action = room.makeAction("pair");
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { void room.leave(); reject(new Error("No device found with that code.")); }, timeoutMs);
    action.onMessage = async (data) => {
      try {
        const raw = await decryptBytes(key, new Uint8Array(data as ArrayBuffer));
        clearTimeout(t);
        void room.leave();
        resolve(JSON.parse(new TextDecoder().decode(raw)));
      } catch { /* wrong code or noise */ }
    };
  });
}

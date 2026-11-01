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
  console.info("p2p joined room", roomId.slice(0, 4));

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

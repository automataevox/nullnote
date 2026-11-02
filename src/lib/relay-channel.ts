/**
 * Fallback transport: when a direct WebRTC link can't be made (strict NAT,
 * VPNs, mobile carriers), peers exchange the SAME already-encrypted payloads
 * through public Nostr relays as ephemeral events. Relays only ever see
 * ciphertext addressed to a hashed topic — zero-knowledge is preserved.
 */
import type { SimplePool as Pool } from "nostr-tools/pool";

export const RELAYS = [
  "wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net",
  "wss://nostr.mom", "wss://relay.snort.social",
];
const KIND = 25087; // ephemeral range: relays forward, never store
const CHUNK = 24_000;

let poolP: Promise<Pool> | null = null;
const pool = () =>
  (poolP ??= import("nostr-tools/pool").then((m) => new m.SimplePool()));

const b64 = (u: Uint8Array) => { let s = ""; for (const x of u) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rid = () => b64(crypto.getRandomValues(new Uint8Array(9)));

async function topicHash(t: string) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("nullnote-relay:" + t)));
  return [...h.slice(0, 16)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export type RelayMsg = { from: string; data: Uint8Array; to?: string | undefined };

/** Join a topic. `self` is this device's random id. Returns send + close. */
export async function relayChannel(topic: string, self: string, onMsg: (m: RelayMsg) => void) {
  const [p, { generateSecretKey, finalizeEvent }, x] = await Promise.all([
    pool(), import("nostr-tools/pure"), topicHash(topic),
  ]);
  const sk = generateSecretKey();
  const parts = new Map<string, { n: number; got: (string | undefined)[]; at: number }>();

  const sub = p.subscribeMany(RELAYS, { kinds: [KIND], "#x": [x], since: Math.floor(Date.now() / 1000) - 10 }, {
    onevent(ev) {
      try {
        const c = JSON.parse(ev.content) as { s: string; t?: string; m: string; i: number; n: number; d: string };
        if (c.s === self || (c.t && c.t !== self)) return;
        let e = parts.get(c.m);
        if (!e) { e = { n: c.n, got: [], at: Date.now() }; parts.set(c.m, e); }
        if (e.got[c.i] !== undefined) return; // duplicate from another relay
        e.got[c.i] = c.d;
        if (e.got.filter((v) => v !== undefined).length === e.n) {
          parts.delete(c.m);
          onMsg({ from: c.s, to: c.t, data: unb64(e.got.join("")) });
        }
        // forget stale partials
        for (const [k, v] of parts) if (Date.now() - v.at > 60_000) parts.delete(k);
      } catch { /* noise */ }
    },
  });

  const send = async (data: Uint8Array, to?: string) => {
    const s = b64(data);
    const n = Math.max(1, Math.ceil(s.length / CHUNK));
    const m = rid();
    for (let i = 0; i < n; i++) {
      const ev = finalizeEvent({
        kind: KIND, created_at: Math.floor(Date.now() / 1000), tags: [["x", x]],
        content: JSON.stringify({ s: self, t: to, m, i, n, d: s.slice(i * CHUNK, (i + 1) * CHUNK) }),
      }, sk);
      await Promise.allSettled(p.publish(RELAYS, ev));
    }
  };

  return { send, close: () => sub.close() };
}

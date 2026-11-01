// Zero-knowledge crypto helpers (WebCrypto only, runs in the browser).
const enc = new TextEncoder();
const dec = new TextDecoder();

export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export function toB64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function fromB64(str: string): Uint8Array {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export const PBKDF2_ITERATIONS = 600_000;

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function importRawKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Output layout: 12-byte IV || ciphertext */
export async function encryptBytes(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data as BufferSource));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

export async function decryptBytes(key: CryptoKey, blob: Uint8Array): Promise<Uint8Array> {
  const iv = blob.slice(0, 12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, blob.slice(12) as BufferSource);
  return new Uint8Array(pt);
}

export const encryptJson = (key: CryptoKey, v: unknown) => encryptBytes(key, enc.encode(JSON.stringify(v)));
export const decryptJson = async <T>(key: CryptoKey, b: Uint8Array): Promise<T> =>
  JSON.parse(dec.decode(await decryptBytes(key, b))) as T;

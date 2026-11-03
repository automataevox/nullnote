import { get, set, del, keys as getAllKeys } from "idb-keyval";
import * as Y from "yjs";
import { decryptBytes, decryptJson, deriveKey, encryptBytes, encryptJson, randomBytes } from "./crypto";

export type FolderEntry = { id: string; shared?: { room: string; key: string } };
type VaultMeta = { salt: Uint8Array; check: Uint8Array };

export const uid = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, "0")).join("");
};

export async function vaultExists() {
  return !!(await get<VaultMeta>("meta"));
}

export async function deleteVault() {
  const keys = await getAllKeys();
  const vaultKeys = keys.filter(
    (key) => key === "meta" || key === "index" || (typeof key === "string" && key.startsWith("doc:")),
  );
  await Promise.all(vaultKeys.map((key) => del(key)));
}

export async function createVault(password: string): Promise<CryptoKey> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  await set("meta", { salt, check: await encryptJson(key, "ok") });
  await saveIndex(key, []);
  return key;
}

export async function unlockVault(password: string): Promise<CryptoKey> {
  const meta = await get<VaultMeta>("meta");
  if (!meta) throw new Error("No vault");
  const key = await deriveKey(password, meta.salt);
  try {
    await decryptJson(key, meta.check);
  } catch {
    throw new Error("Wrong password");
  }
  return key;
}

export async function loadIndex(key: CryptoKey): Promise<FolderEntry[]> {
  const b = await get<Uint8Array>("index");
  return b ? decryptJson<FolderEntry[]>(key, b) : [];
}
export async function saveIndex(key: CryptoKey, idx: FolderEntry[]) {
  await set("index", await encryptJson(key, idx));
}

export async function loadDoc(key: CryptoKey, id: string): Promise<Y.Doc> {
  const doc = new Y.Doc();
  const b = await get<Uint8Array>("doc:" + id);
  if (b) Y.applyUpdate(doc, await decryptBytes(key, b), "load");
  return doc;
}
export async function saveDoc(key: CryptoKey, id: string, doc: Y.Doc) {
  await set("doc:" + id, await encryptBytes(key, Y.encodeStateAsUpdate(doc)));
}
export const deleteDoc = (id: string) => del("doc:" + id);

/** Debounced encrypted autosave of every change. */
export function autosave(key: CryptoKey, id: string, doc: Y.Doc) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const h = (_u: Uint8Array, origin: unknown) => {
    if (origin === "load") return;
    clearTimeout(t);
    t = setTimeout(() => void saveDoc(key, id, doc), 150);
  };
  doc.on("update", h);
  return () => {
    clearTimeout(t);
    doc.off("update", h);
    void saveDoc(key, id, doc);
  };
}

// ---------- Document model helpers ----------
export type NoteKind = "note" | "secret";
export type SecretType = "password" | "ssh" | "api" | "card" | "habit";

export const notesMap = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>("notes");
export const folderMeta = (doc: Y.Doc) => doc.getMap<string>("meta");

export function createNote(doc: Y.Doc, kind: NoteKind, secretType?: SecretType) {
  const id = uid();
  doc.transact(() => {
    const m = new Y.Map<unknown>();
    m.set("title", "");
    m.set("kind", kind);
    if (secretType) m.set("secretType", secretType);
    m.set("fields", new Y.Map<string>());
    m.set("updatedAt", Date.now());
    notesMap(doc).set(id, m);
  });
  return id;
}

export const SECRET_FIELDS: Record<SecretType, { key: string; label: string; secret?: boolean; multiline?: boolean }[]> = {
  password: [
    { key: "username", label: "Username" },
    { key: "password", label: "Password", secret: true },
    { key: "url", label: "Website" },
    { key: "totp", label: "2FA secret", secret: true },
  ],
  ssh: [
    { key: "host", label: "Host" },
    { key: "user", label: "User" },
    { key: "publicKey", label: "Public key", multiline: true },
    { key: "privateKey", label: "Private key", secret: true, multiline: true },
    { key: "passphrase", label: "Passphrase", secret: true },
  ],
  api: [
    { key: "service", label: "Service" },
    { key: "keyId", label: "Key ID" },
    { key: "secret", label: "Secret", secret: true },
  ],
  habit: [
    { key: "goal", label: "Goal" },
    { key: "frequency", label: "Frequency" },
    { key: "reminder", label: "Reminder" },
  ],
  card: [
    { key: "holder", label: "Cardholder" },
    { key: "number", label: "Number", secret: true },
    { key: "expiry", label: "Expiry" },
    { key: "cvv", label: "CVV", secret: true },
  ],
};

export function generatePassword(len = 20) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*-_=+";
  return Array.from(randomBytes(len), (b) => chars[b % chars.length]).join("");
}

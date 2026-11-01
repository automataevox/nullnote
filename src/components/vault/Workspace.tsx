import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import {
  ChevronRight, FileText, MessageCircle, FolderPlus, KeyRound, Lock, MoreHorizontal, Plus, Share2, Users, CreditCard, Terminal, Code2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { randomBytes, toB64 } from "@/lib/crypto";
import { connectRoom } from "@/lib/p2p";
import {
  autosave, createNote, deleteDoc, saveDoc, folderMeta, loadDoc, loadIndex, notesMap, saveIndex, uid,
  type FolderEntry, type SecretType,
} from "@/lib/vault";
import { NoteView } from "./NoteView";
import { ChatPanel } from "./ChatPanel";
import { ThemeToggle } from "./ThemeToggle";
import { useY } from "./use-y";

type Folder = { entry: FolderEntry; doc: Y.Doc; peers: number };
type Sel = { folder: string; note: string } | null;

// Capture a "#join=room.key" link once, at app load, and strip it from the address bar.
let pendingJoin: { room: string; key: string } | null = null;
if (typeof window !== "undefined") {
  const m = window.location.hash.match(/^#join=([\w-]+)\.([\w-]+)$/);
  if (m) {
    pendingJoin = { room: m[1]!, key: m[2]! };
    history.replaceState(null, "", window.location.pathname);
  }
}
let loadChain: Promise<void> = Promise.resolve();

export function Workspace({ vaultKey, onLock }: { vaultKey: CryptoKey; onLock: () => void }) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [sel, setSel] = useState<Sel>(null);
  const [shareFor, setShareFor] = useState<string | null>(null);
  const [chatFor, setChatFor] = useState<string | null>(null);
  const cleanups = useRef(new Map<string, (() => void)[]>());
  const indexRef = useRef<FolderEntry[]>([]);

  const setPeers = (id: string, n: number) =>
    setFolders((fs) => fs.map((f) => (f.entry.id === id ? { ...f, peers: n } : f)));

  const mount = useCallback(async (entry: FolderEntry): Promise<Folder> => {
    const doc = await loadDoc(vaultKey, entry.id);
    const fns = [autosave(vaultKey, entry.id, doc)];
    if (entry.shared) fns.push(await connectRoom(doc, entry.shared.room, entry.shared.key, (n) => setPeers(entry.id, n)));
    cleanups.current.set(entry.id, fns);
    return { entry, doc, peers: 0 };
  }, [vaultKey]);

  const persistIndex = (idx: FolderEntry[]) => { indexRef.current = idx; void saveIndex(vaultKey, idx); };

  // Initial load + join-from-link (serialized so a double-mounted effect can't race)
  useEffect(() => {
    let alive = true;
    loadChain = loadChain.then(async () => {
      if (!alive) return;
      let idx = await loadIndex(vaultKey);
      if (pendingJoin) {
        const j = pendingJoin;
        pendingJoin = null;
        if (!idx.some((e) => e.shared?.room === j.room)) {
          idx = [...idx, { id: uid(), shared: j }];
          await saveIndex(vaultKey, idx);
          toast("Joined shared folder — syncing with peers…");
        }
      }
      indexRef.current = idx;
      const loaded = await Promise.all(idx.map(mount));
      if (loaded.length === 0) {
        const f = await mount({ id: uid() });
        f.doc.transact(() => {
          folderMeta(f.doc).set("name", "Personal");
          const n = createNote(f.doc, "note");
          notesMap(f.doc).get(n)!.set("title", "Welcome");
        });
        await saveDoc(vaultKey, f.entry.id, f.doc);
        persistIndex([f.entry]);
        loaded.push(f);
      }
      if (!alive) {
        cleanups.current.forEach((fns) => fns.forEach((f) => f()));
        cleanups.current.clear();
        return;
      }
      setFolders(loaded);
    });
    return () => {
      alive = false;
      cleanups.current.forEach((fns) => fns.forEach((f) => f()));
      cleanups.current.clear();
    };
  }, [vaultKey, mount]);

  const addFolder = async () => {
    const f = await mount({ id: uid() });
    folderMeta(f.doc).set("name", "New folder");
    persistIndex([...indexRef.current, f.entry]);
    setFolders((fs) => [...fs, f]);
  };

  const removeFolder = async (id: string) => {
    if (!confirm("Remove this folder from this device?")) return;
    cleanups.current.get(id)?.forEach((f) => f());
    cleanups.current.delete(id);
    await deleteDoc(id);
    persistIndex(indexRef.current.filter((e) => e.id !== id));
    setFolders((fs) => fs.filter((f) => f.entry.id !== id));
    if (sel?.folder === id) setSel(null);
  };

  const shareFolder = async (id: string) => {
    const f = folders.find((x) => x.entry.id === id)!;
    if (!f.entry.shared) {
      const entry = { ...f.entry, shared: { room: toB64(randomBytes(16)), key: toB64(randomBytes(32)) } };
      const stop = await connectRoom(f.doc, entry.shared.room, entry.shared.key, (n) => setPeers(id, n));
      cleanups.current.get(id)?.push(stop);
      persistIndex(indexRef.current.map((e) => (e.id === id ? entry : e)));
      setFolders((fs) => fs.map((x) => (x.entry.id === id ? { ...x, entry } : x)));
    }
    setShareFor(id);
  };

  const newNote = (folderId: string, kind: "note" | "secret", t?: SecretType) => {
    const f = folders.find((x) => x.entry.id === folderId)!;
    setSel({ folder: folderId, note: createNote(f.doc, kind, t) });
  };

  const current = sel && folders.find((f) => f.entry.id === sel.folder);
  const shareTarget = folders.find((f) => f.entry.id === shareFor);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="flex w-72 shrink-0 flex-col border-r bg-sidebar">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="animate-spin-slow h-5 w-5 rounded-[5px] bg-primary shadow-glow" />
            <span className="font-semibold tracking-tight">nullnote</span>
          </div>
          <div className="flex">
            <ThemeToggle />
            <Button variant="ghost" size="icon" aria-label="New folder" onClick={addFolder}><FolderPlus className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Lock vault" onClick={onLock}><Lock className="h-4 w-4" /></Button>
          </div>
        </div>
        <nav className="stagger flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {folders.map((f) => (
            <FolderTree key={f.entry.id} folder={f} sel={sel} onSelect={(note) => setSel({ folder: f.entry.id, note })}
              onNew={(k, t) => newNote(f.entry.id, k, t)} onShare={() => shareFolder(f.entry.id)} onRemove={() => removeFolder(f.entry.id)} onChat={() => setChatFor(f.entry.id)} />
          ))}
        </nav>
        <div className="border-t px-4 py-3 font-mono text-[11px] text-muted-foreground">
          encrypted · local-first · p2p
        </div>
      </aside>

      <main className="relative flex-1 overflow-y-auto">
        {(current ?? folders[0]) && !chatFor && (
          <Button variant="accent" size="icon" aria-label="Open chat" className="fixed bottom-6 right-6 z-20 h-12 w-12 rounded-full"
            onClick={() => setChatFor((current ?? folders[0])!.entry.id)}>
            <MessageCircle className="h-5 w-5" />
          </Button>
        )}
        {current ? (
          <NoteView key={sel!.note} doc={current.doc} id={sel!.note}
            onDelete={() => { notesMap(current.doc).delete(sel!.note); setSel(null); }} />
        ) : (
          <div className="relative flex h-full flex-col items-center justify-center gap-3 overflow-hidden text-sm text-muted-foreground">
            <div className="bg-grid pointer-events-none absolute inset-0" />
            <div className="orb animate-float pointer-events-none absolute h-72 w-72 rounded-full" />
            <p className="text-shimmer relative text-2xl font-semibold tracking-tight">Your private space.</p>
            <p className="animate-fade-up relative">Select a note, or press + on a folder to create one.</p>
          </div>
        )}
      </main>
      {(() => {
        const cf = folders.find((f) => f.entry.id === chatFor);
        return cf ? <ChatPanel key={cf.entry.id} doc={cf.doc} shared={!!cf.entry.shared} peers={cf.peers} onClose={() => setChatFor(null)} /> : null;
      })()}

      <Dialog open={!!shareTarget} onOpenChange={(o) => !o && setShareFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share folder live</DialogTitle>
            <DialogDescription>
              Anyone with this link can read and edit this folder in real time. Data flows directly between devices,
              end-to-end encrypted. The key lives only in the link — send it privately.
            </DialogDescription>
          </DialogHeader>
          {shareTarget?.entry.shared && <ShareLink shared={shareTarget.entry.shared} peers={shareTarget.peers} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ShareLink({ shared, peers }: { shared: { room: string; key: string }; peers: number }) {
  const link = `${window.location.origin}/#join=${shared.room}.${shared.key}`;
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input readOnly value={link} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Button onClick={() => { void navigator.clipboard.writeText(link); toast("Link copied"); }}>Copy</Button>
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn("h-2 w-2 rounded-full", peers ? "bg-highlight animate-pulse-dot" : "bg-border animate-pulse")} />
        {peers ? `${peers} peer${peers > 1 ? "s" : ""} connected` : "Waiting for peers… both devices must have the app open."}
      </p>
    </div>
  );
}

const ICON = { note: FileText, password: KeyRound, ssh: Terminal, api: Code2, card: CreditCard } as const;

function FolderTree(p: {
  folder: Folder; sel: Sel; onSelect: (id: string) => void; onNew: (k: "note" | "secret", t?: SecretType) => void;
  onShare: () => void; onRemove: () => void; onChat: () => void;
}) {
  const { doc, entry, peers } = p.folder;
  const meta = folderMeta(doc);
  const notes = notesMap(doc);
  useY(meta);
  useY(notes);
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const list = [...notes.entries()].sort((a, b) => ((b[1].get("updatedAt") as number) ?? 0) - ((a[1].get("updatedAt") as number) ?? 0));

  return (
    <div>
      <div className="group flex h-8 items-center gap-1 rounded-md px-1.5 hover:bg-sidebar-accent">
        <button aria-label="Toggle folder" onClick={() => setOpen(!open)} className="text-muted-foreground">
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        </button>
        {editing ? (
          <input autoFocus defaultValue={meta.get("name") ?? ""} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
            onBlur={(e) => { meta.set("name", e.target.value || "Untitled"); setEditing(false); }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
        ) : (
          <span onDoubleClick={() => setEditing(true)} className="min-w-0 flex-1 truncate text-sm font-medium">
            {meta.get("name") ?? (entry.shared ? "Syncing…" : "Untitled")}
          </span>
        )}
        {entry.shared && (
          <span title={`${peers} peers online`} className="flex items-center gap-0.5 font-mono text-[10px] text-highlight">
            <Users className="h-3 w-3" />{peers}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Add to folder" className="rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"><Plus className="h-3.5 w-3.5" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => p.onNew("note")}><FileText className="mr-2 h-4 w-4" />Note</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => p.onNew("secret", "password")}><KeyRound className="mr-2 h-4 w-4" />Password</DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.onNew("secret", "ssh")}><Terminal className="mr-2 h-4 w-4" />SSH key</DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.onNew("secret", "api")}><Code2 className="mr-2 h-4 w-4" />API credential</DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.onNew("secret", "card")}><CreditCard className="mr-2 h-4 w-4" />Card</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Folder options" className="rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"><MoreHorizontal className="h-3.5 w-3.5" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={p.onShare}><Share2 className="mr-2 h-4 w-4" />{entry.shared ? "Share link" : "Share live…"}</DropdownMenuItem>
            <DropdownMenuItem onClick={p.onChat}><MessageCircle className="mr-2 h-4 w-4" />Open chat</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditing(true)}>Rename</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={p.onRemove}>Remove from device</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {open && (
        <div className="animate-fade-up ml-4 border-l pl-1.5">
          {list.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">Empty</p>}
          {list.map(([id, n]) => {
            const Icon = ICON[(n.get("kind") === "secret" ? n.get("secretType") : "note") as keyof typeof ICON] ?? FileText;
            const active = p.sel?.note === id;
            return (
              <button key={id} onClick={() => p.onSelect(id)}
                className={cn("flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-muted-foreground transition-all duration-200 hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-foreground",
                  active && "bg-sidebar-accent text-foreground shadow-[inset_2px_0_0_var(--highlight)]")}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{(n.get("title") as string) || "Untitled"}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { AlertTriangle, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createVault, deleteVault, unlockVault, vaultExists } from "@/lib/vault";
import { ThemeToggle } from "./ThemeToggle";

export function UnlockScreen({ onUnlock }: { onUnlock: (k: CryptoKey) => void }) {
  const cryptoAvailable =
    typeof window !== "undefined" && window.isSecureContext && !!window.crypto?.subtle;
  const [exists, setExists] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleteErr, setDeleteErr] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    void vaultExists().then(setExists);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!exists) {
      if (pw.length < 8) return setErr("Use at least 8 characters.");
      if (pw !== pw2) return setErr("Passwords don't match.");
    }
    setBusy(true);
    try {
      onUnlock(exists ? await unlockVault(pw) : await createVault(pw));
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (deletePhrase !== "DELETE") return;
    setDeleteBusy(true);
    setDeleteErr("");
    try {
      await deleteVault();
      setExists(false);
      setPw("");
      setPw2("");
      setErr("");
      setDeletePhrase("");
      setDeleteOpen(false);
    } catch (error) {
      setDeleteErr(error instanceof Error ? error.message : "Unable to delete vault data.");
    } finally {
      setDeleteBusy(false);
    }
  };

  if (exists === null) return null;

  if (!cryptoAvailable) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8">
        <ThemeToggle className="absolute right-4 top-4 z-10" />
        <div className="w-full max-w-md space-y-3 rounded-xl border bg-background/90 p-6 shadow-lift sm:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Secure connection required</h1>
          <p className="text-sm text-muted-foreground">
            This browser only provides the encryption API over HTTPS or localhost. On a phone, use a
            trusted HTTPS development certificate or an HTTPS tunnel, then reopen this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      <ThemeToggle className="absolute right-4 top-4 z-10" />
      <div className="bg-grid pointer-events-none absolute inset-0" />
      <div className="orb animate-float pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full" />
      <div className="relative w-full max-w-sm space-y-3">
        <form
          onSubmit={submit}
          className="stagger relative w-full space-y-6 rounded-2xl border bg-background/80 p-8 shadow-lift backdrop-blur"
        >
          <div className="space-y-3">
            <div className="animate-float flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lift">
              <Lock className="h-5 w-5" />
            </div>
            <h1 className="text-shimmer text-2xl font-semibold tracking-tight">
              {exists ? "Unlock your vault" : "Create your vault"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {exists
                ? "Your notes are encrypted on this device."
                : "Everything is encrypted with this password on your device. It can't be recovered — there is no server."}
            </p>
          </div>
          <div className="space-y-3">
            <Input
              type="password"
              autoFocus
              placeholder="Master password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
            {!exists && (
              <Input
                type="password"
                placeholder="Repeat password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
              />
            )}
            {err && <p className="text-sm text-destructive">{err}</p>}
          </div>
          <Button type="submit" variant="hero" className="w-full" disabled={busy}>
            {busy ? "Deriving key…" : exists ? "Unlock" : "Create vault"}
          </Button>
          <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-highlight" /> AES-256-GCM · PBKDF2 600k · local
            only
          </p>
        </form>
        {exists && (
          <details className="group rounded-lg border border-transparent px-3 py-2 transition-colors open:border-destructive/30 open:bg-destructive/5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs text-muted-foreground hover:text-destructive [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <Trash2 className="h-3.5 w-3.5" /> Delete vault data
              </span>
              <span aria-hidden="true" className="transition-transform group-open:rotate-180">
                ⌄
              </span>
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Permanently remove this device&apos;s encrypted vault and all its notes.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setDeletePhrase("");
                setDeleteErr("");
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Continue to deletion
            </Button>
          </details>
        )}
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto border-destructive/40 sm:w-full">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Delete this vault permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes this device&apos;s encrypted vault, including all folders and notes. This
              cannot be undone and will not delete copies on other devices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="delete-vault-confirm" className="text-sm font-medium">
              Type DELETE to confirm
            </label>
            <Input
              id="delete-vault-confirm"
              autoComplete="off"
              value={deletePhrase}
              onChange={(event) => setDeletePhrase(event.target.value)}
            />
            {deleteErr && (
              <p role="alert" className="text-sm text-destructive">
                {deleteErr}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePhrase !== "DELETE" || deleteBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {deleteBusy ? "Deleting…" : "Delete vault data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

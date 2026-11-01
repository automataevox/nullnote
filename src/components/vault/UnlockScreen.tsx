import { useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createVault, unlockVault, vaultExists } from "@/lib/vault";

export function UnlockScreen({ onUnlock }: { onUnlock: (k: CryptoKey) => void }) {
  const [exists, setExists] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

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

  if (exists === null) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-6">
        <div className="space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {exists ? "Unlock your vault" : "Create your vault"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {exists
              ? "Your notes are encrypted on this device."
              : "Everything is encrypted with this password on your device. It can't be recovered — there is no server."}
          </p>
        </div>
        <div className="space-y-3">
          <Input type="password" autoFocus placeholder="Master password" value={pw} onChange={(e) => setPw(e.target.value)} />
          {!exists && (
            <Input type="password" placeholder="Repeat password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Deriving key…" : exists ? "Unlock" : "Create vault"}
        </Button>
        <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-highlight" /> AES-256-GCM · PBKDF2 600k · local only
        </p>
      </form>
    </div>
  );
}

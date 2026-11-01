import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { hostPairing, joinPairing, newPairCode } from "@/lib/p2p";

type Share = { room: string; key: string };

export function PairButton({ shareAll, addShares }: {
  shareAll: () => Promise<Share[]>; addShares: (s: Share[]) => Promise<number>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"show" | "enter">("show");
  const [code, setCode] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open || mode !== "show") return;
    const c = newPairCode();
    setCode(c);
    let stop: (() => void) | undefined;
    let alive = true;
    void hostPairing(c, shareAll, () => toast("Device paired — folders syncing")).then((s) => (alive ? (stop = s) : s()));
    return () => { alive = false; stop?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const n = await addShares(await joinPairing(typed));
      toast(n ? `Paired — ${n} folder${n > 1 ? "s" : ""} syncing` : "Already paired");
      setOpen(false); setTyped("");
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Pair device" onClick={() => setOpen(true)}><Link2 className="h-4 w-4" /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pair a device</DialogTitle>
            <DialogDescription>Sync all folders between this device and another one, directly and encrypted.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(["show", "enter"] as const).map((m) => (
              <Button key={m} size="sm" variant={mode === m ? "default" : "ghost"} onClick={() => setMode(m)}>
                {m === "show" ? "Show code" : "Enter code"}
              </Button>
            ))}
          </div>
          {mode === "show" ? (
            <div className="space-y-3 text-center">
              <p className="select-all font-mono text-3xl font-semibold tracking-widest">{code}</p>
              <p className="text-xs text-muted-foreground">Type this code on the other device. Keep this window open until it connects.</p>
            </div>
          ) : (
            <form onSubmit={join} className="space-y-3">
              <Input autoFocus placeholder="XXXX-XXXX-XXXX" value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())}
                className="text-center font-mono text-lg tracking-widest" />
              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button type="submit" variant="hero" className="w-full" disabled={busy || typed.replace(/[^A-Z0-9]/gi, "").length < 12}>
                {busy ? "Looking for device…" : "Pair"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

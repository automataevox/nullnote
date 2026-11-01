import { useEffect, useState } from "react";
import { Download, Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type BIP = Event & { prompt: () => Promise<void> };
let deferred: BIP | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as BIP; });
}

const DESKTOP = [
  { os: "Windows", file: "nullnote-win32-x64.zip" },
  { os: "macOS (Apple Silicon)", file: "nullnote-darwin-arm64.zip" },
  { os: "macOS (Intel)", file: "nullnote-darwin-x64.zip" },
  { os: "Linux", file: "nullnote-linux-x64.tar.gz" },
];

export function DownloadButton() {
  const [open, setOpen] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [available, setAvailable] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    setCanInstall(!!deferred);
    DESKTOP.forEach((d) =>
      fetch(`/downloads/${d.file}`, { method: "HEAD" })
        .then((r) => setAvailable((a) => ({ ...a, [d.file]: r.ok && !r.headers.get("content-type")?.includes("text/html") })))
        .catch(() => {}),
    );
  }, [open]);

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Get the app" onClick={() => setOpen(true)}><Download className="h-4 w-4" /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Get nullnote</DialogTitle>
            <DialogDescription>Your vault stays on each device. Use share links to sync between them.</DialogDescription>
          </DialogHeader>
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-medium"><Smartphone className="h-4 w-4" />Phone & tablet</h3>
            {canInstall ? (
              <Button variant="hero" className="w-full" onClick={async () => { await deferred?.prompt(); deferred = null; setCanInstall(false); }}>
                Install app
              </Button>
            ) : (
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li><b className="text-foreground">iPhone/iPad:</b> open in Safari → Share → Add to Home Screen.</li>
                <li><b className="text-foreground">Android:</b> open in Chrome → menu ⋮ → Install app.</li>
              </ul>
            )}
          </section>
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-medium"><Monitor className="h-4 w-4" />Desktop</h3>
            <div className="grid grid-cols-2 gap-2">
              {DESKTOP.map((d) =>
                available[d.file] ? (
                  <Button key={d.file} variant="outline" asChild><a href={`/downloads/${d.file}`} download>{d.os}</a></Button>
                ) : (
                  <Button key={d.file} variant="outline" disabled>{d.os}</Button>
                ),
              )}
            </div>
            {!DESKTOP.some((d) => available[d.file]) && (
              <p className="text-xs text-muted-foreground">Desktop downloads appear here once the app is published.</p>
            )}
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useEffect, useState } from "react";
import { Download, Monitor, Smartphone, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import winAsset from "../../../public/downloads/nullnote-win32-x64.zip.asset.json";
import macArmAsset from "../../../public/downloads/nullnote-darwin-arm64.zip.asset.json";
import macIntelAsset from "../../../public/downloads/nullnote-darwin-x64.zip.asset.json";
import linuxAsset from "../../../public/downloads/nullnote-linux-x64.tar.gz.asset.json";
import appImageAsset from "../../../public/downloads/nullnote-x86_64.AppImage.asset.json";

type BIP = Event & { prompt: () => Promise<void> };
let deferred: BIP | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as BIP; });
}

const DESKTOP = [
  { os: "Windows", file: "nullnote-win32-x64.zip", url: winAsset.url },
  { os: "macOS (Apple Silicon)", file: "nullnote-darwin-arm64.zip", url: macArmAsset.url },
  { os: "macOS (Intel)", file: "nullnote-darwin-x64.zip", url: macIntelAsset.url },
  { os: "Linux (tar.gz)", file: "nullnote-linux-x64.tar.gz", url: linuxAsset.url },
];

export function DownloadButton() {
  const [open, setOpen] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    if (open) setCanInstall(!!deferred);
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
              {DESKTOP.map((d) => (
                <Button key={d.file} variant="outline" asChild><a href={d.url} download={d.file}>{d.os}</a></Button>
              ))}
              <Button variant="outline" asChild className="col-span-2">
                <a href={appImageAsset.url} download="nullnote-x86_64.AppImage">Linux — AppImage (universal, v1.0.1)</a>
              </Button>
            </div>
            <details className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <summary className="flex cursor-pointer items-center gap-2 font-medium"><Terminal className="h-3.5 w-3.5" />Install instructions</summary>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li><b className="text-foreground">AppImage (recommended):</b> download, then run <code className="rounded bg-muted px-1">chmod +x nullnote-x86_64.AppImage</code> and double-click it. If it won't start, install <code className="rounded bg-muted px-1">libfuse2</code> (e.g. <code className="rounded bg-muted px-1">sudo apt install libfuse2</code>).</li>
                <li><b className="text-foreground">tar.gz:</b> extract with <code className="rounded bg-muted px-1">tar -xzf nullnote-linux-x64.tar.gz</code>, then run <code className="rounded bg-muted px-1">./nullnote-linux-x64/nullnote</code>.</li>
                <li><b className="text-foreground">Windows:</b> unzip, run <code className="rounded bg-muted px-1">nullnote.exe</code>. If SmartScreen warns, click "More info" → "Run anyway" (the app is unsigned).</li>
                <li><b className="text-foreground">macOS:</b> unzip and drag the app anywhere, then right-click → Open the first time (unsigned, so Gatekeeper asks once).</li>
              </ul>
            </details>
            <p className="text-xs text-muted-foreground">Desktop apps run fully offline. Pair with your browser via Pair device to sync.</p>
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}

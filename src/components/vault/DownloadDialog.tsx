import { useEffect, useState } from "react";
import { Download, Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import winAsset from "../../../public/downloads/nullnote-win32-x64.zip.asset.json";
import macArmAsset from "../../../public/downloads/nullnote-darwin-arm64.zip.asset.json";
import macIntelAsset from "../../../public/downloads/nullnote-darwin-x64.zip.asset.json";
import linuxAsset from "../../../public/downloads/nullnote-linux-x64.tar.gz.asset.json";

type BIP = Event & { prompt: () => Promise<void> };
let deferred: BIP | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as BIP; });
}

const DESKTOP = [
  { os: "Windows", file: "nullnote-win32-x64.zip", url: winAsset.url },
  { os: "macOS (Apple Silicon)", file: "nullnote-darwin-arm64.zip", url: macArmAsset.url },
  { os: "macOS (Intel)", file: "nullnote-darwin-x64.zip", url: macIntelAsset.url },
  { os: "Linux", file: "nullnote-linux-x64.tar.gz", url: linuxAsset.url },
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
            </div>
            <p className="text-xs text-muted-foreground">Desktop apps run fully offline. Pair with your browser via Pair device to sync.</p>
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}

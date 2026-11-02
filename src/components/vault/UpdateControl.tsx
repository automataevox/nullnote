import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type UpdateStatus = {
  state:
    | "checking"
    | "current"
    | "available"
    | "downloading"
    | "downloaded"
    | "manual"
    | "error"
    | "unsupported";
  latestVersion?: string;
  percent?: number;
  error?: string;
};

type UpdaterApi = {
  getStatus: () => Promise<UpdateStatus>;
  check: () => Promise<UpdateStatus>;
  download: () => Promise<UpdateStatus>;
  install: () => Promise<void>;
  openRelease: () => Promise<void>;
  onStatus: (callback: (status: UpdateStatus) => void) => () => void;
};

declare global {
  interface Window {
    nullnoteUpdater?: UpdaterApi;
  }
}

export function UpdateControl({ onInstall }: { onInstall: () => Promise<void> }) {
  const [status, setStatus] = useState<UpdateStatus>({ state: "checking" });
  const updater = typeof window !== "undefined" ? window.nullnoteUpdater : undefined;

  useEffect(() => {
    if (!window.nullnoteUpdater) return;
    let active = true;
    const stop = window.nullnoteUpdater.onStatus((next) => setStatus(next));
    void window.nullnoteUpdater.getStatus().then((next) => {
      if (active) setStatus(next);
    });
    return () => {
      active = false;
      stop();
    };
  }, []);

  if (!updater) return null;

  if (status.state === "current") {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-xs"
        onClick={() => void updater.check()}
      >
        <Check className="h-3.5 w-3.5" /> Up to date · Check again
      </Button>
    );
  }
  if (status.state === "available") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start text-xs"
        onClick={() => void updater.download()}
      >
        <ArrowDownToLine className="h-3.5 w-3.5" /> Update to {status.latestVersion}
      </Button>
    );
  }
  if (status.state === "downloading") {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Downloading update ·{" "}
        {Math.round(status.percent ?? 0)}%
      </div>
    );
  }
  if (status.state === "downloaded") {
    return (
      <Button
        variant="accent"
        size="sm"
        className="w-full justify-start text-xs"
        onClick={() => void onInstall()}
      >
        <RotateCw className="h-3.5 w-3.5" /> Restart to install {status.latestVersion}
      </Button>
    );
  }
  if (status.state === "manual") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start text-xs"
        onClick={() => void updater.openRelease()}
      >
        <ExternalLink className="h-3.5 w-3.5" /> Download update {status.latestVersion}
      </Button>
    );
  }
  if (status.state === "error") {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-xs text-muted-foreground"
        title={status.error}
        onClick={() => void updater.check()}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Update check failed · Retry
      </Button>
    );
  }
  if (status.state === "unsupported") return null;
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Checking for updates…
    </div>
  );
}

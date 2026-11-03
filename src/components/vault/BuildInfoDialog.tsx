import { useEffect, useState } from "react";
import { ExternalLink, History, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const RELEASE_API = "https://api.github.com/repos/automataevox/nullnote/releases/tags";
const RELEASE_PAGE = "https://github.com/automataevox/nullnote/releases";

type ReleaseInfo = {
  html_url?: string;
  body?: string | null;
};

function parseNotes(markdown: string) {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^#{1,6}\s/.test(line) && !/^full changelog:?$/i.test(line))
    .map((line) =>
      line
        .replace(/^[-*+]\s+/, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/`([^`]+)`/g, "$1"),
    )
    .filter(Boolean);
}

export function BuildInfoDialog({
  appVersion,
  gitVersion,
}: {
  appVersion: string;
  gitVersion: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [entries, setEntries] = useState<string[] | null>(null);
  const [releaseUrl, setReleaseUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const tag = appVersion.startsWith("v") ? appVersion : `v${appVersion}`;

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    setEntries(null);
    setReleaseUrl(null);

    void fetch(`${RELEASE_API}/${encodeURIComponent(tag)}`, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
        return (await response.json()) as ReleaseInfo;
      })
      .then((release) => {
        if (!active) return;
        if (!release) {
          setEntries([]);
          return;
        }
        setEntries(parseNotes(release.body ?? ""));
        setReleaseUrl(release.html_url ?? null);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "Unable to load release notes.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, retry, tag]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start px-2 font-mono text-[11px] text-muted-foreground"
        aria-label={`View version ${appVersion} changelog`}
        onClick={() => setOpen(true)}
      >
        <History className="h-3.5 w-3.5" /> build {gitVersion}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>nullnote {appVersion}</DialogTitle>
            <DialogDescription>
              Release notes for this version · build {gitVersion}
            </DialogDescription>
          </DialogHeader>
          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading release notes…
            </p>
          )}
          {error && (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Could not load this version&apos;s release notes: {error}</p>
              <Button variant="outline" size="sm" onClick={() => setRetry((count) => count + 1)}>
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          )}
          {!loading && !error && entries?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No published changelog is available for version {appVersion} yet.
            </p>
          )}
          {!loading && !error && entries && entries.length > 0 && (
            <ul className="max-h-[50dvh] list-disc space-y-2 overflow-y-auto pl-5 text-sm leading-relaxed">
              {entries.map((entry, index) => (
                <li key={`${index}-${entry}`}>{entry}</li>
              ))}
            </ul>
          )}
          {releaseUrl && (
            <a
              href={releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-2 text-sm text-highlight hover:underline"
            >
              View release on GitHub <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {entries === null && !loading && !error && (
            <a
              href={RELEASE_PAGE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-2 text-sm text-highlight hover:underline"
            >
              Browse releases <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

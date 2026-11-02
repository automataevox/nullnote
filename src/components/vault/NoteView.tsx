import { useState } from "react";
import * as Y from "yjs";
import { Copy, Eye, EyeOff, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SECRET_FIELDS, generatePassword, notesMap, type SecretType } from "@/lib/vault";
import { RichEditor } from "./RichEditor";
import { useY } from "./use-y";

export function NoteView({ doc, id, onDelete }: { doc: Y.Doc; id: string; onDelete: () => void }) {
  const note = notesMap(doc).get(id);
  useY(note);
  if (!note) return <div className="p-10 text-sm text-muted-foreground">This note was deleted.</div>;

  const kind = note.get("kind") as string;
  const secretType = note.get("secretType") as SecretType | undefined;
  const fields = note.get("fields") as Y.Map<string>;

  return (
    <div className="animate-fade-up mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10 md:px-14">
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {kind === "secret" ? `vault · ${secretType}` : "note"}
        </span>
        <Button variant="ghost" size="icon" aria-label="Delete note" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <input
        value={(note.get("title") as string) ?? ""}
        onChange={(e) => doc.transact(() => { note.set("title", e.target.value); note.set("updatedAt", Date.now()); })}
        placeholder="Untitled"
        className="mb-6 w-full min-w-0 bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50 sm:text-4xl"
      />
      {kind === "secret" && secretType && <SecretFields fields={fields} type={secretType} />}
      <RichEditor key={id} doc={doc} field={"n:" + id} placeholder={kind === "secret" ? "Notes…" : undefined} />
    </div>
  );
}

function SecretFields({ fields, type }: { fields: Y.Map<string>; type: SecretType }) {
  useY(fields);
  return (
    <div className="stagger mb-8 divide-y rounded-xl border shadow-sm transition-shadow focus-within:shadow-glow">
      {SECRET_FIELDS[type].map((f) => (
        <SecretRow key={f.key} label={f.label} value={fields.get(f.key) ?? ""} secret={f.secret} multiline={f.multiline}
          onChange={(v) => fields.set(f.key, v)}
          onGenerate={f.key === "password" ? () => fields.set(f.key, generatePassword()) : undefined} />
      ))}
    </div>
  );
}

function SecretRow(p: { label: string; value: string; secret?: boolean | undefined; multiline?: boolean | undefined; onChange: (v: string) => void; onGenerate?: (() => void) | undefined }) {
  const [show, setShow] = useState(!p.secret);
  const copy = async () => {
    await navigator.clipboard.writeText(p.value);
    toast("Copied — clipboard clears in 30s");
    setTimeout(() => void navigator.clipboard.writeText("").catch(() => {}), 30000);
  };
  const cls = "border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0 px-0";
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
      <span className="w-20 shrink-0 pt-2 text-xs text-muted-foreground sm:w-28">{p.label}</span>
      <div className="min-w-0 flex-1">
        {p.multiline && show ? (
          <Textarea value={p.value} onChange={(e) => p.onChange(e.target.value)} rows={4} className={cls} />
        ) : (
          <Input type={show ? "text" : "password"} value={p.value} onChange={(e) => p.onChange(e.target.value)} className={cls} />
        )}
      </div>
      <div className="flex shrink-0 gap-0.5 pt-0.5">
        {p.onGenerate && <Button variant="ghost" size="icon" aria-label="Generate" onClick={p.onGenerate}><RefreshCw className="h-3.5 w-3.5" /></Button>}
        {p.secret && <Button variant="ghost" size="icon" aria-label={show ? "Hide" : "Show"} onClick={() => setShow(!show)}>{show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>}
        <Button variant="ghost" size="icon" aria-label="Copy" onClick={copy} disabled={!p.value}><Copy className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

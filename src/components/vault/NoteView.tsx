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
          {kind === "secret" ? (secretType === "habit" ? "habit" : `vault · ${secretType}`) : "note"}
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
      {kind === "secret" && secretType === "habit" && <HabitGrid fields={fields} />}
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

const dayKey = (d: Date) => "d:" + d.toISOString().slice(0, 10);
const WEEKS = 26;

function HabitGrid({ fields }: { fields: Y.Map<string> }) {
  useY(fields);
  const today = new Date(); today.setUTCHours(12, 0, 0, 0);
  // Grid ends on this week's Sunday; columns are weeks starting Monday.
  const end = new Date(today); end.setUTCDate(end.getUTCDate() + ((7 - end.getUTCDay()) % 7));
  const days = Array.from({ length: WEEKS * 7 }, (_, i) => { const d = new Date(end); d.setUTCDate(d.getUTCDate() - (WEEKS * 7 - 1 - i)); return d; });
  const done = (d: Date) => fields.get(dayKey(d)) === "1";
  const future = (d: Date) => d.getTime() > today.getTime();
  const toggle = (d: Date) => { if (future(d)) return; const k = dayKey(d); if (done(d)) fields.delete(k); else fields.set(k, "1"); };

  const past = days.filter((d) => !future(d));
  let streak = 0;
  for (let i = past.length - 1; i >= 0; i--) { if (done(past[i]!)) streak++; else if (i === past.length - 1) continue; else break; }
  let best = 0, run = 0;
  for (const d of past) { run = done(d) ? run + 1 : 0; best = Math.max(best, run); }
  const last30 = past.slice(-30).filter(done).length;
  const total = Array.from(fields.keys()).filter((k) => k.startsWith("d:") && fields.get(k) === "1").length;
  const week = past.slice(-7);
  const weeks = Array.from({ length: WEEKS }, (_, w) => days.slice(w * 7, w * 7 + 7));
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString(undefined, { timeZone: "UTC", ...o });

  return (
    <div className="mb-8 space-y-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
        {[["Current streak", `${streak}`, streak === 1 ? "day" : "days"], ["Best streak", `${best}`, best === 1 ? "day" : "days"],
          ["30-day rate", `${Math.round((last30 / 30) * 100)}`, "%"], ["Total check-ins", `${total}`, ""]].map(([l, v, u]) => (
          <div key={l} className="bg-background p-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{l}</div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{v}<span className="ml-1 text-sm font-normal text-muted-foreground">{u}</span></div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">This week</div>
            <div className="text-xs text-muted-foreground">{week.filter(done).length} of 7 days completed</div>
          </div>
          <Button size="sm" variant={done(today) ? "outline" : "default"} onClick={() => toggle(today)}>
            {done(today) ? "Completed today" : "Check in today"}
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {week.map((d) => (
            <button key={d.toISOString()} onClick={() => toggle(d)} aria-pressed={done(d)}
              className={`flex flex-col items-center gap-1 rounded-lg border py-2 text-xs transition-colors ${done(d) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <span className="opacity-70">{fmt(d, { weekday: "short" })}</span>
              <span className="font-mono text-sm font-semibold">{fmt(d, { day: "numeric" })}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium">Last 6 months</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            Missed <span className="h-2.5 w-2.5 rounded-[3px] bg-muted" /> <span className="h-2.5 w-2.5 rounded-[3px] bg-primary" /> Done
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="inline-flex gap-[3px]">
            <div className="mr-1 grid grid-rows-7 gap-[3px] pt-4 text-[10px] leading-[11px] text-muted-foreground">
              {["Mon", "", "Wed", "", "Fri", "", ""].map((l, i) => <span key={i} className="h-[11px]">{l}</span>)}
            </div>
            {weeks.map((w, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                <span className="h-[13px] text-[10px] leading-none text-muted-foreground">
                  {w[0]!.getUTCDate() <= 7 ? fmt(w[0]!, { month: "short" }) : ""}
                </span>
                {w.map((d) => (
                  <button key={d.toISOString()} onClick={() => toggle(d)} disabled={future(d)}
                    title={`${fmt(d, { dateStyle: "medium" })} — ${done(d) ? "done" : "not done"}`}
                    aria-label={`${fmt(d, { dateStyle: "medium" })} ${done(d) ? "done" : "not done"}`}
                    className={`h-[11px] w-[11px] rounded-[3px] transition-colors ${future(d) ? "bg-transparent" : done(d) ? "bg-primary" : "bg-muted hover:bg-muted-foreground/30"} ${dayKey(d) === dayKey(today) ? "ring-1 ring-foreground/40 ring-offset-1 ring-offset-background" : ""}`} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { ArrowUp, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { folderMeta } from "@/lib/vault";
import { useY } from "./use-y";

export type ChatMsg = { id: string; from: string; name: string; text: string; at: number };

const MY_ID_KEY = "nullnote:me";
function me() {
  let v = localStorage.getItem(MY_ID_KEY);
  if (!v) {
    v = JSON.stringify({ id: crypto.randomUUID(), name: "" });
    localStorage.setItem(MY_ID_KEY, v);
  }
  return JSON.parse(v) as { id: string; name: string };
}

export const chatArray = (doc: Y.Doc) => doc.getArray<ChatMsg>("chat");

export function ChatPanel({ doc, shared, peers, onClose }: { doc: Y.Doc; shared: boolean; peers: number; onClose: () => void }) {
  const msgs = chatArray(doc);
  useY(msgs);
  useY(folderMeta(doc));
  const [self, setSelf] = useState(me);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const list = msgs.toArray();

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [list.length]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    msgs.push([{ id: crypto.randomUUID(), from: self.id, name: self.name || "Anonymous", text: t, at: Date.now() }]);
    setText("");
  };

  const setName = (name: string) => {
    const v = { ...self, name };
    localStorage.setItem(MY_ID_KEY, JSON.stringify(v));
    setSelf(v);
  };

  return (
    <aside className="animate-slide-in-right flex w-80 shrink-0 flex-col border-l bg-background">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{folderMeta(doc).get("name") ?? "Chat"}</p>
          <p className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <span className={cn("h-1.5 w-1.5 rounded-full", peers ? "bg-highlight animate-pulse-dot" : "bg-border")} />
            {shared ? `${peers} online · e2e encrypted` : "private · share folder to chat"}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close chat" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {list.length === 0 && (
          <div className="animate-fade-up flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <Lock className="h-5 w-5" />
            Messages live inside this folder, encrypted, and travel directly between devices.
          </div>
        )}
        {list.map((m, i) => {
          const mine = m.from === self.id;
          const grouped = i > 0 && list[i - 1]!.from === m.from && m.at - list[i - 1]!.at < 120000;
          return (
            <div key={m.id} className={cn("animate-pop-in flex flex-col", mine ? "items-end" : "items-start", grouped && "-mt-2")}>
              {!grouped && (
                <span className="mb-1 font-mono text-[10px] text-muted-foreground">
                  {mine ? "you" : m.name} · {new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <div className={cn("max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm",
                mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-secondary text-secondary-foreground")}>
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      <div className="border-t p-3">
        <input value={self.name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
          className="mb-2 w-full bg-transparent font-mono text-[11px] text-muted-foreground outline-none" />
        <form onSubmit={send} className="flex items-end gap-2 rounded-xl border bg-muted p-1.5 transition-shadow focus-within:shadow-glow">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Message…"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) send(e); }}
            className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none" />
          <Button type="submit" size="icon" variant="accent" aria-label="Send" disabled={!text.trim()} className="h-8 w-8 rounded-lg">
            <ArrowUp className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </aside>
  );
}

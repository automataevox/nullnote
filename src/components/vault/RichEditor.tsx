import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Bold, Code, Heading1, Heading2, Italic, List, ListChecks, ListOrdered, Quote, SquareCode } from "lucide-react";
import type * as Y from "yjs";
import { cn } from "@/lib/utils";

export function RichEditor({ doc, field, placeholder }: { doc: Y.Doc; field: string; placeholder?: string }) {
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Placeholder.configure({ placeholder: placeholder ?? "Write, or use Markdown: # heading, - list, [] task, ``` code" }),
        Collaboration.configure({ document: doc, field }),
      ],
      editorProps: { attributes: { class: "prose-note" } },
    },
    [doc, field],
  );

  if (!editor) return null;
  const btn = (active: boolean, onClick: () => void, Icon: typeof Bold, label: string) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        active && "bg-accent text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
  const c = () => editor.chain().focus();

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-1 mb-4 flex flex-wrap gap-0.5 bg-background/90 py-1.5 backdrop-blur">
        {btn(editor.isActive("heading", { level: 1 }), () => c().toggleHeading({ level: 1 }).run(), Heading1, "Heading 1")}
        {btn(editor.isActive("heading", { level: 2 }), () => c().toggleHeading({ level: 2 }).run(), Heading2, "Heading 2")}
        {btn(editor.isActive("bold"), () => c().toggleBold().run(), Bold, "Bold")}
        {btn(editor.isActive("italic"), () => c().toggleItalic().run(), Italic, "Italic")}
        {btn(editor.isActive("code"), () => c().toggleCode().run(), Code, "Inline code")}
        {btn(editor.isActive("bulletList"), () => c().toggleBulletList().run(), List, "Bullet list")}
        {btn(editor.isActive("orderedList"), () => c().toggleOrderedList().run(), ListOrdered, "Numbered list")}
        {btn(editor.isActive("taskList"), () => c().toggleTaskList().run(), ListChecks, "Checklist")}
        {btn(editor.isActive("blockquote"), () => c().toggleBlockquote().run(), Quote, "Quote")}
        {btn(editor.isActive("codeBlock"), () => c().toggleCodeBlock().run(), SquareCode, "Code block")}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

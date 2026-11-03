import { useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { common, createLowlight } from "lowlight";
import {
  Bold,
  CalendarDays,
  Calculator,
  Code,
  Heading1,
  Heading2,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  SquareCode,
} from "lucide-react";
import type * as Y from "yjs";
import { cn } from "@/lib/utils";
import { getEditorCompletions, type EditorCompletion } from "@/lib/editor-plugins/registry";

const lowlight = createLowlight(common);

type CompletionState = {
  items: EditorCompletion[];
  from: number;
  to: number;
  left: number;
  top: number;
  activeIndex: number;
};

export function RichEditor({
  doc,
  field,
  placeholder,
}: {
  doc: Y.Doc;
  field: string;
  placeholder?: string | undefined;
}) {
  const [completion, setCompletion] = useState<CompletionState | null>(null);
  const completionRef = useRef<CompletionState | null>(null);
  completionRef.current = completion;

  const syncCompletions = (editor: NonNullable<ReturnType<typeof useEditor>>) => {
    const { selection } = editor.state;
    const parent = selection.$from.parent;
    if (!selection.empty || !parent.isTextblock || parent.type.name === "codeBlock") {
      setCompletion(null);
      return;
    }

    const textBeforeCursor = parent.textContent.slice(0, selection.$from.parentOffset);
    const items = getEditorCompletions({ textBeforeCursor, now: new Date() });
    if (!items.length) {
      setCompletion(null);
      return;
    }

    const coordinates = editor.view.coordsAtPos(selection.from);
    const menuWidth = 320;
    setCompletion({
      items,
      from: selection.from - items[0]!.deleteBefore,
      to: selection.from,
      left: Math.max(12, Math.min(coordinates.left, window.innerWidth - menuWidth - 12)),
      top: Math.max(12, Math.min(coordinates.bottom + 8, window.innerHeight - 190)),
      activeIndex: 0,
    });
  };

  const applyCompletion = (
    editor: NonNullable<ReturnType<typeof useEditor>>,
    state: CompletionState,
    index = state.activeIndex,
  ) => {
    const suggestion = state.items[index];
    if (!suggestion) return;
    editor
      .chain()
      .focus()
      .insertContentAt({ from: state.from, to: state.to }, suggestion.insertText)
      .run();
    setCompletion(null);
  };

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ undoRedo: false, codeBlock: false }),
        CodeBlockLowlight.configure({ lowlight, defaultLanguage: null }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Placeholder.configure({
          placeholder:
            placeholder ?? "Write, or use Markdown: # heading, - list, [] task, ``` code",
        }),
        Collaboration.configure({ document: doc, field }),
      ],
      onUpdate: ({ editor }) => syncCompletions(editor),
      onSelectionUpdate: ({ editor }) => syncCompletions(editor),
      editorProps: {
        attributes: { class: "prose-note" },
        handleKeyDown: (view, event) => {
          const state = completionRef.current;
          if (!state) return false;
          if (event.key === "Escape") {
            setCompletion(null);
            return true;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const delta = event.key === "ArrowDown" ? 1 : -1;
            setCompletion({
              ...state,
              activeIndex: (state.activeIndex + delta + state.items.length) % state.items.length,
            });
            return true;
          }
          if (event.key === "Tab" || event.key === "Enter") {
            event.preventDefault();
            const suggestion = state.items[state.activeIndex];
            if (suggestion) {
              view.dispatch(view.state.tr.insertText(suggestion.insertText, state.from, state.to));
              setCompletion(null);
            }
            return true;
          }
          return false;
        },
      },
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
        {btn(
          editor.isActive("heading", { level: 1 }),
          () => c().toggleHeading({ level: 1 }).run(),
          Heading1,
          "Heading 1",
        )}
        {btn(
          editor.isActive("heading", { level: 2 }),
          () => c().toggleHeading({ level: 2 }).run(),
          Heading2,
          "Heading 2",
        )}
        {btn(editor.isActive("bold"), () => c().toggleBold().run(), Bold, "Bold")}
        {btn(editor.isActive("italic"), () => c().toggleItalic().run(), Italic, "Italic")}
        {btn(editor.isActive("code"), () => c().toggleCode().run(), Code, "Inline code")}
        {btn(
          editor.isActive("bulletList"),
          () => c().toggleBulletList().run(),
          List,
          "Bullet list",
        )}
        {btn(
          editor.isActive("orderedList"),
          () => c().toggleOrderedList().run(),
          ListOrdered,
          "Numbered list",
        )}
        {btn(
          editor.isActive("taskList"),
          () => c().toggleTaskList().run(),
          ListChecks,
          "Checklist",
        )}
        {btn(editor.isActive("blockquote"), () => c().toggleBlockquote().run(), Quote, "Quote")}
        {btn(
          editor.isActive("codeBlock"),
          () => c().toggleCodeBlock().run(),
          SquareCode,
          "Code block",
        )}
      </div>
      <EditorContent editor={editor} />
      {completion && (
        <div
          className="editor-completions"
          role="listbox"
          aria-label="Editor plugin suggestions"
          style={{ left: completion.left, top: completion.top }}
        >
          {completion.items.map((item, index) => (
            <button
              key={`${item.pluginId}-${item.title}-${index}`}
              type="button"
              role="option"
              aria-selected={index === completion.activeIndex}
              className={cn("editor-completion", index === completion.activeIndex && "is-active")}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyCompletion(editor, completion, index)}
            >
              <span
                className={cn(
                  "editor-completion-icon",
                  item.pluginId === "nullnote.calculator" ? "is-calculator" : "is-calendar",
                )}
              >
                {item.pluginId === "nullnote.calculator" ? (
                  <Calculator className="h-4 w-4" />
                ) : (
                  <CalendarDays className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
              </span>
              <span className="editor-completion-plugin">
                {item.pluginId.replace("nullnote.", "")}
              </span>
            </button>
          ))}
          <div className="editor-completion-hint">Tab or Enter to insert · Esc to dismiss</div>
        </div>
      )}
    </div>
  );
}

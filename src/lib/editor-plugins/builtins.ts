import { Parser } from "expr-eval";
import type { EditorPlugin } from "./types";

const calculator = new Parser({ allowMemberAccess: false });

const calculatorPlugin: EditorPlugin = {
  id: "nullnote.calculator",
  name: "Calculator",
  suggest: ({ textBeforeCursor }) => {
    const match = /([0-9][0-9\s()+\-*/%.^]*)\s*=\s*$/.exec(textBeforeCursor);
    if (!match || match.index === undefined) return [];

    const expression = match[1]!.trim();
    if (!expression || expression.length > 120) return [];

    try {
      const parsed = calculator.parse(expression);
      if (parsed.variables().length > 0) return [];
      const result = parsed.evaluate();
      if (!Number.isFinite(result)) return [];

      const formatted = new Intl.NumberFormat(undefined, {
        maximumSignificantDigits: 12,
      }).format(Object.is(result, -0) ? 0 : result);

      return [
        {
          pluginId: "nullnote.calculator",
          title: formatted,
          detail: `${expression} = ${formatted}`,
          insertText: `${expression} = ${formatted}`,
          deleteBefore: textBeforeCursor.length - match.index,
        },
      ];
    } catch {
      return [];
    }
  },
};

const localDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const calendarPlugin: EditorPlugin = {
  id: "nullnote.calendar",
  name: "Calendar",
  suggest: ({ textBeforeCursor, now }) => {
    const match = /(?:^|\s)@(date|today|tomorrow|yesterday)$/.exec(textBeforeCursor);
    if (!match || match.index === undefined) return [];

    const commandStart = textBeforeCursor.length - match[1]!.length - 1;
    const command = match[1]!.toLowerCase();
    const offsets =
      command === "date"
        ? [0, 1, -1]
        : [command === "tomorrow" ? 1 : command === "yesterday" ? -1 : 0];

    return offsets.map((offset) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      const label = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : "Yesterday";
      const value = localDateKey(date);
      return {
        pluginId: "nullnote.calendar",
        title: label,
        detail: new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(date),
        insertText: value,
        deleteBefore: textBeforeCursor.length - commandStart,
      };
    });
  },
};

export const BUILTIN_EDITOR_PLUGINS = [calculatorPlugin, calendarPlugin] satisfies EditorPlugin[];

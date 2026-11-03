import { describe, expect, it } from "vitest";
import { getEditorCompletions, registerEditorPlugin } from "@/lib/editor-plugins/registry";

describe("built-in editor plugins", () => {
  it("suggests a safe calculation completion after equals", () => {
    const [suggestion] = getEditorCompletions({
      textBeforeCursor: "4 * 2 = ",
      now: new Date(2026, 10, 3),
    });
    expect(suggestion).toMatchObject({
      pluginId: "nullnote.calculator",
      title: "8",
      insertText: "4 * 2 = 8",
      deleteBefore: 8,
    });
  });

  it("does not evaluate expressions with non-arithmetic syntax", () => {
    expect(getEditorCompletions({ textBeforeCursor: "alert(1) = ", now: new Date() })).toEqual([]);
    expect(getEditorCompletions({ textBeforeCursor: "1 / 0 = ", now: new Date() })).toEqual([]);
  });

  it("offers date completions from the calendar plugin", () => {
    const suggestions = getEditorCompletions({
      textBeforeCursor: "Meet me @date",
      now: new Date(2026, 10, 3),
    });
    expect(suggestions.map((suggestion) => suggestion.title)).toEqual([
      "Today",
      "Tomorrow",
      "Yesterday",
    ]);
    expect(suggestions.map((suggestion) => suggestion.insertText)).toEqual([
      "2026-11-03",
      "2026-11-04",
      "2026-11-02",
    ]);
  });

  it("supports registering and disposing community plugins", () => {
    const unregister = registerEditorPlugin({
      id: "community.test",
      name: "Community test",
      suggest: ({ textBeforeCursor }) =>
        textBeforeCursor.endsWith("!plugin")
          ? [
              {
                pluginId: "community.test",
                title: "Plugin",
                detail: "Test",
                insertText: "installed",
                deleteBefore: 7,
              },
            ]
          : [],
    });

    expect(getEditorCompletions({ textBeforeCursor: "!plugin", now: new Date() })).toHaveLength(1);
    unregister();
    expect(getEditorCompletions({ textBeforeCursor: "!plugin", now: new Date() })).toEqual([]);
  });
});

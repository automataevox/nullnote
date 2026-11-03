import { BUILTIN_EDITOR_PLUGINS } from "./builtins";
import type { EditorCompletion, EditorPlugin, EditorPluginContext } from "./types";

const plugins = new Map<string, EditorPlugin>(
  BUILTIN_EDITOR_PLUGINS.map((plugin) => [plugin.id, plugin]),
);

/** Register a bundled community plugin. Returns a disposer for tests or scoped plugins. */
export function registerEditorPlugin(plugin: EditorPlugin): () => void {
  if (!plugin.id.trim() || !plugin.name.trim() || typeof plugin.suggest !== "function") {
    throw new Error("An editor plugin needs an id, name, and suggest function.");
  }
  if (plugins.has(plugin.id)) throw new Error(`Editor plugin already registered: ${plugin.id}`);

  plugins.set(plugin.id, plugin);
  return () => {
    if (plugins.get(plugin.id) === plugin) plugins.delete(plugin.id);
  };
}

export function getEditorCompletions(context: EditorPluginContext): EditorCompletion[] {
  const completions: EditorCompletion[] = [];
  for (const plugin of plugins.values()) {
    try {
      completions.push(
        ...plugin
          .suggest(context)
          .filter(
            (completion) =>
              completion.pluginId === plugin.id &&
              completion.deleteBefore > 0 &&
              completion.deleteBefore <= context.textBeforeCursor.length &&
              completion.insertText.length > 0,
          ),
      );
    } catch (error) {
      console.error(`Editor plugin "${plugin.id}" failed to provide suggestions.`, error);
    }
  }
  return completions;
}

export type { EditorCompletion, EditorPlugin, EditorPluginContext } from "./types";

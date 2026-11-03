export type EditorPluginContext = {
  textBeforeCursor: string;
  now: Date;
};

export type EditorCompletion = {
  pluginId: string;
  title: string;
  detail: string;
  insertText: string;
  deleteBefore: number;
};

export type EditorPlugin = {
  id: string;
  name: string;
  suggest: (context: EditorPluginContext) => EditorCompletion[];
};

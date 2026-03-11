import type { LexicalEditor } from 'lexical';

import { parseTemplate } from '../parser/parseTemplate.js';
import type { RegisterFreemarkerPluginOptions } from '../types.js';

export function registerFreemarkerPlugin(
  editor: LexicalEditor,
  options: RegisterFreemarkerPluginOptions,
): () => void {
  const cleanups = options.factories.map((factory) => factory.register(editor));

  const unregisterUpdate = editor.registerUpdateListener(({ editorState }) => {
    if (!options.onDiagnostics) {
      return;
    }

    editorState.read(() => {
      const text = editorState.toJSON().root.children
        .map((child) => readSerializedText(child))
        .join('');
      options.onDiagnostics?.(parseTemplate(text).diagnostics);
    });
  });

  return () => {
    unregisterUpdate();
    for (const cleanup of cleanups.reverse()) {
      cleanup();
    }
  };
}

function readSerializedText(node: Record<string, unknown>): string {
  if (typeof node.text === 'string') {
    return node.text;
  }

  if (!Array.isArray(node.children)) {
    return '';
  }

  return node.children
    .filter((child): child is Record<string, unknown> => !!child && typeof child === 'object')
    .map((child) => readSerializedText(child))
    .join('');
}

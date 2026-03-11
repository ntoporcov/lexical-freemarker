import { useEffect, useMemo, useState } from 'react';

import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  type EditorState,
  type LexicalEditor,
} from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, ListItemNode, ListNode, REMOVE_LIST_COMMAND } from '@lexical/list';
import { $createHeadingNode, $createQuoteNode, HeadingNode, QuoteNode } from '@lexical/rich-text';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';

import { createIfNodeFactory, parseTemplate, registerFreemarkerPlugin, type FreemarkerDiagnostic } from '@mininic-nt/lexical-freemarker';

import { $createIfCardNode, IfCardNode } from './nodes/IfCardNode';
import { serializeEditorDocument } from './serialization/serializeEditorDocument';

const DEFAULT_DOCUMENT = () => {
  const root = $getRoot();
  root.clear();
  const heading = $createHeadingNode('h1');
  heading.append($createTextNode('Freemarker playground'));
  const paragraph = $createParagraphNode();
  paragraph.append($createTextNode('Mix normal Lexical content with Freemarker cards in one document.'));
  root.append(heading, paragraph, $createIfCardNode({
    condition: 'user.age >= 18',
    content: 'Adult block',
    elseContent: 'Minor block',
    hasElse: true,
  }), $createParagraphNode());
};

export function App() {
  const [editor, setEditor] = useState<LexicalEditor | null>(null);
  const [output, setOutput] = useState('');
  const [diagnostics, setDiagnostics] = useState<FreemarkerDiagnostic[]>([]);
  const ifFactory = useMemo(() => createIfNodeFactory(), []);

  useEffect(() => {
    if (!editor) {
      return;
    }

    return registerFreemarkerPlugin(editor, {
      factories: [ifFactory],
      onDiagnostics(nextDiagnostics) {
        setDiagnostics(nextDiagnostics);
      },
    });
  }, [editor, ifFactory]);

  const initialConfig = useMemo(
    () => ({
      namespace: 'lexical-freemarker-tester',
      theme: {
        paragraph: 'editor-paragraph',
        heading: {
          h1: 'editor-h1',
          h2: 'editor-h2',
        },
        quote: 'editor-quote',
        list: {
          ul: 'editor-list',
          ol: 'editor-list',
          listitem: 'editor-list-item',
        },
        text: {
          bold: 'text-bold',
          italic: 'text-italic',
        },
      },
      editorState: DEFAULT_DOCUMENT,
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, IfCardNode, ifFactory.nodeClass as any],
      onError(error: Error) {
        throw error;
      },
    }),
    [ifFactory.nodeClass],
  );

  return (
    <div className="tester-shell">
      <div className="tester-backdrop tester-backdrop-a" />
      <div className="tester-backdrop tester-backdrop-b" />
      <header className="hero">
        <div>
          <p className="eyebrow">Lexical Freemarker Tester</p>
          <h1>Rich text on one side, real template output on the other.</h1>
          <p className="lede">
            Use headings, lists, and multiple Freemarker If cards in the same editor. The output panel serializes the full document in order.
          </p>
        </div>
        <div className="hero-chip">Node pair: <code>rich-text + if-card</code></div>
      </header>

      <LexicalComposer initialConfig={initialConfig}>
        <EditorBridge onReady={setEditor} />
        <main className="grid">
          <section className="card card-editor">
            <div className="card-heading">
              <div>
                <h2>Editor</h2>
                <p>Real Lexical rich-text setup with heading, list, quote, and Freemarker card insertion.</p>
              </div>
            </div>
            <Toolbar />
            <div className="editor-wrap">
              <RichTextPlugin
                contentEditable={<ContentEditable className="editor-surface" aria-label="Freemarker rich text editor" />}
                placeholder={<div className="editor-placeholder">Write content, then drop in If cards where you need template logic.</div>}
                ErrorBoundary={LexicalErrorBoundary}
              />
            </div>
            <HistoryPlugin />
            <ListPlugin />
            <OnChangePlugin
              onChange={(nextEditorState: EditorState, nextEditor: LexicalEditor) => {
                setEditor(nextEditor);
                setOutput(serializeEditorDocument(nextEditorState));
                setDiagnostics(parseTemplate(serializeEditorDocument(nextEditorState)).diagnostics);
              }}
            />
          </section>

          <section className="card card-output">
            <div className="card-heading">
              <div>
                <h2>Template Output</h2>
                <p>Serialized Freemarker text for the full mixed document.</p>
              </div>
            </div>
            <pre>{output}</pre>
          </section>

          <section className="card card-diagnostics">
            <div className="card-heading">
              <div>
                <h2>Diagnostics</h2>
                <p>Parser diagnostics against the live serialized template.</p>
              </div>
            </div>
            {diagnostics.length === 0 ? (
              <p className="empty-state">No diagnostics. Suspiciously civilized.</p>
            ) : (
              <ul className="diagnostics-list">
                {diagnostics.map((diagnostic, index) => (
                  <li key={`${diagnostic.code}-${index}`}>
                    <strong>{diagnostic.code}</strong>
                    <span>{diagnostic.message}</span>
                    <code>
                      {diagnostic.start}-{diagnostic.end}
                    </code>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </LexicalComposer>
    </div>
  );
}

function Toolbar() {
  const [editor] = useLexicalComposerContext();

  const setBlock = (mode: 'paragraph' | 'h1' | 'h2' | 'quote') => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        return;
      }

      if (mode === 'paragraph') {
        $setBlocksType(selection, () => $createParagraphNode());
        return;
      }

      if (mode === 'quote') {
        $setBlocksType(selection, () => $createQuoteNode());
        return;
      }

      $setBlocksType(selection, () => $createHeadingNode(mode));
    });
  };

  const insertIfNode = () => {
    editor.update(() => {
      $insertNodes([$createIfCardNode(), $createParagraphNode()]);
    });
  };

  return (
    <div className="toolbar">
      <button type="button" onClick={() => setBlock('paragraph')}>Paragraph</button>
      <button type="button" onClick={() => setBlock('h1')}>H1</button>
      <button type="button" onClick={() => setBlock('h2')}>H2</button>
      <button type="button" onClick={() => setBlock('quote')}>Quote</button>
      <button type="button" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}>Bullets</button>
      <button type="button" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}>Numbers</button>
      <button type="button" onClick={() => editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)}>Unlist</button>
      <button type="button" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}>Bold</button>
      <button type="button" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}>Italic</button>
      <button type="button" className="toolbar-primary" onClick={insertIfNode}>Insert If card</button>
    </div>
  );
}

function EditorBridge({ onReady }: { onReady: (editor: LexicalEditor) => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    onReady(editor);
  }, [editor, onReady]);

  return null;
}

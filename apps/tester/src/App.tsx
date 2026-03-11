import { useEffect, useMemo, useRef, useState } from 'react';

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

import { createIfNodeFactory, parseTemplate, type FreemarkerDiagnostic } from '@mininic-nt/lexical-freemarker';

import { $createIfCardNode, IfCardNode } from './nodes/IfCardNode';
import { exportEditorDocument, importEditorDocument, type OutputFormat } from './serialization/roundTrip';

const DEFAULT_DOCUMENT = () => {
  const root = $getRoot();
  root.clear();
  const heading = $createHeadingNode('h1');
  heading.append($createTextNode('Freemarker playground'));
  const paragraph = $createParagraphNode();
  paragraph.append($createTextNode('Mix normal Lexical content with Freemarker cards in one document.'));
  root.append(
    heading,
    paragraph,
    $createIfCardNode({
      condition: 'user.age >= 18',
      content: 'Adult block',
      elseContent: 'Minor block',
      hasElse: true,
    }),
    $createParagraphNode(),
  );
};

const FORMAT_OPTIONS: Array<{ value: OutputFormat; label: string }> = [
  { value: 'plain', label: 'Plain Text' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'html', label: 'HTML' },
];

export function App() {
  const [editor, setEditor] = useState<LexicalEditor | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<OutputFormat>('plain');
  const [roundTripText, setRoundTripText] = useState('');
  const [diagnostics, setDiagnostics] = useState<FreemarkerDiagnostic[]>([]);
  const lastSyncedRef = useRef('');
  const importTimerRef = useRef<number | null>(null);
  const ifFactory = useMemo(() => createIfNodeFactory(), []);

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

  useEffect(() => {
    return () => {
      if (importTimerRef.current !== null) {
        window.clearTimeout(importTimerRef.current);
      }
    };
  }, []);

  const queueImport = (value: string, format: OutputFormat) => {
    if (!editor) {
      return;
    }

    if (importTimerRef.current !== null) {
      window.clearTimeout(importTimerRef.current);
    }

    importTimerRef.current = window.setTimeout(async () => {
      try {
        await importEditorDocument(editor, value, format);
      } catch {
        // Keep the editor stable. Best-effort import should never nuke the session.
      }
    }, 350);
  };

  const syncFromEditor = (editorState: EditorState, format: OutputFormat) => {
    const nextOutput = exportEditorDocument(editorState, format);
    lastSyncedRef.current = nextOutput;
    setRoundTripText(nextOutput);
    setDiagnostics(parseTemplate(exportEditorDocument(editorState, 'plain')).diagnostics);
  };

  useEffect(() => {
    if (!editor) {
      return;
    }

    syncFromEditor(editor.getEditorState(), selectedFormat);
  }, [editor, selectedFormat]);

  return (
    <div className="tester-shell">
      <div className="tester-backdrop tester-backdrop-a" />
      <div className="tester-backdrop tester-backdrop-b" />
      <header className="hero">
        <div>
          <p className="eyebrow">Lexical Freemarker Tester</p>
          <h1>Round-trip the document through plain text, markdown, or HTML without dropping the template layer.</h1>
          <p className="lede">
            Rich text stays editable on the left, exported output stays editable on the right, and Freemarker cards sit cleanly between the two worlds.
          </p>
        </div>
        <div className="hero-chip">Mode: <code>{selectedFormat}</code></div>
      </header>

      <LexicalComposer initialConfig={initialConfig}>
        <EditorBridge onReady={setEditor} />
        <main className="grid grid-two-column">
          <section className="card card-editor-full">
            <div className="card-heading">
              <div>
                <h2>Editor</h2>
                <p>Rich text nodes and Freemarker If cards in one document.</p>
              </div>
            </div>
            <Toolbar />
            <div className="editor-wrap">
              <RichTextPlugin
                contentEditable={<ContentEditable className="editor-surface" aria-label="Freemarker rich text editor" />}
                placeholder={<div className="editor-placeholder">Write rich text, then insert If cards where template logic belongs.</div>}
                ErrorBoundary={LexicalErrorBoundary}
              />
            </div>
            <HistoryPlugin />
            <ListPlugin />
            <OnChangePlugin
              onChange={(nextEditorState: EditorState, nextEditor: LexicalEditor) => {
                setEditor(nextEditor);
                syncFromEditor(nextEditorState, selectedFormat);
              }}
            />
          </section>

          <section className="card card-output-full">
            <div className="card-heading card-heading-stacked">
              <div>
                <h2>Round-trip Output</h2>
                <p>Edit the exported representation directly. Changes are imported back into the editor with best-effort format-aware parsing.</p>
              </div>
              <div className="segmented-control" role="tablist" aria-label="Output format selector">
                {FORMAT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={selectedFormat === option.value ? 'segment-active' : ''}
                    onClick={() => setSelectedFormat(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="output-textarea"
              value={roundTripText}
              onChange={(event) => {
                const value = event.target.value;
                setRoundTripText(value);
                if (value !== lastSyncedRef.current) {
                  queueImport(value, selectedFormat);
                }
              }}
            />
          </section>

          <section className="card card-diagnostics">
            <div className="card-heading">
              <div>
                <h2>Diagnostics</h2>
                <p>Live diagnostics from the plain-text Freemarker layer.</p>
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

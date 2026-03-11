import { useEffect, useMemo, useState } from 'react';

import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  type EditorState,
  type LexicalEditor,
} from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

import {
  createIfNodeFactory,
  parseTemplate,
  registerFreemarkerPlugin,
  serializeIfNode,
  type FreemarkerDiagnostic,
  type FreemarkerUiClassMap,
} from '@mininic-nt/lexical-freemarker';

const CLASS_PRESETS: Record<string, FreemarkerUiClassMap> = {
  atelier: {
    panel: 'panel-shell panel-atelier',
    section: 'settings-section',
    label: 'settings-label',
    input: 'settings-input',
    textarea: 'settings-input settings-textarea',
    helpText: 'settings-help',
    row: 'settings-row',
    column: 'settings-column',
    errorText: 'settings-error',
  },
  terminal: {
    panel: 'panel-shell panel-terminal',
    section: 'settings-section',
    label: 'settings-label terminal-label',
    input: 'settings-input terminal-input',
    textarea: 'settings-input settings-textarea terminal-input',
    helpText: 'settings-help terminal-help',
    row: 'settings-row',
    column: 'settings-column',
    errorText: 'settings-error',
  },
  paper: {
    panel: 'panel-shell panel-paper',
    section: 'settings-section',
    label: 'settings-label',
    input: 'settings-input paper-input',
    textarea: 'settings-input settings-textarea paper-input',
    helpText: 'settings-help',
    row: 'settings-row',
    column: 'settings-column',
    errorText: 'settings-error',
  },
};

const DEFAULT_EDITOR_TEXT = [
  '<#if (user.age > 18) && user.active>',
  '  Welcome ${user.name}',
  '<#else>',
  '  Minor',
  '</#if>',
].join('\n');

export function App() {
  const [preset, setPreset] = useState<keyof typeof CLASS_PRESETS>('atelier');
  const [ifExpression, setIfExpression] = useState('(user.age > 18) && user.active');
  const [content, setContent] = useState('Welcome ${user.name}');
  const [elseContent, setElseContent] = useState('Minor');
  const [editorText, setEditorText] = useState(DEFAULT_EDITOR_TEXT);
  const [editor, setEditor] = useState<LexicalEditor | null>(null);
  const [diagnostics, setDiagnostics] = useState<FreemarkerDiagnostic[]>(() =>
    parseTemplate(DEFAULT_EDITOR_TEXT).diagnostics,
  );

  const classes = CLASS_PRESETS[preset];
  const ifFactory = useMemo(
    () =>
      createIfNodeFactory({
        ui: {
          classes,
          perNodeClasses: {
            'freemarker-if': classes,
          },
        },
      }),
    [classes],
  );

  const previewMarkup = useMemo(
    () =>
      String(
        ifFactory.renderSettingsPanel({
          value: { ifExpression },
          onChange(next) {
            setIfExpression(next.ifExpression);
          },
          classes: ifFactory.getUiClasses(),
          diagnostics,
        }),
      ),
    [diagnostics, ifExpression, ifFactory],
  );

  const insertionSnippet = useMemo(
    () =>
      serializeIfNode(
        {
          kind: 'if',
          settings: { ifExpression },
          contentNodeKeys: ['content'],
          elseContentNodeKeys: elseContent.trim().length > 0 ? ['else'] : undefined,
        },
        {
          newline: '\n',
          indent: (depth) => '  '.repeat(depth),
          resolveNodeKey(nodeKey) {
            if (nodeKey === 'content') {
              return content;
            }
            if (nodeKey === 'else') {
              return elseContent;
            }
            return '';
          },
        },
      ),
    [content, elseContent, ifExpression],
  );

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
      },
      editorState() {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(DEFAULT_EDITOR_TEXT));
        root.append(paragraph);
      },
      nodes: [ifFactory.nodeClass as any],
      onError(error: Error) {
        throw error;
      },
    }),
    [ifFactory.nodeClass],
  );

  const insertConditionalSnippet = () => {
    if (!editor) {
      return;
    }

    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText(insertionSnippet);
        return;
      }

      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(insertionSnippet));
      $getRoot().append(paragraph);
    });
  };

  return (
    <div className="tester-shell">
      <div className="tester-backdrop tester-backdrop-a" />
      <div className="tester-backdrop tester-backdrop-b" />
      <header className="hero">
        <div>
          <p className="eyebrow">Lexical Freemarker Tester</p>
          <h1>Conditional node lab, parser pressure chamber, and styling sandbox.</h1>
          <p className="lede">
            The editor is wired with the Conditional factory, plugin diagnostics, serializer preview, and fallback settings panel.
          </p>
        </div>
        <div className="hero-chip">Enabled node: <code>{ifFactory.nodeType}</code></div>
      </header>

      <main className="grid">
        <section className="card card-editor">
          <div className="card-heading">
            <div>
              <h2>Template Editor</h2>
              <p>Plain-text Lexical instance with Freemarker diagnostics running on every update.</p>
            </div>
            <button className="action-button" onClick={insertConditionalSnippet} type="button">
              Insert conditional snippet
            </button>
          </div>

          <LexicalComposer initialConfig={initialConfig}>
            <EditorBridge onReady={setEditor} />
            <PlainTextPlugin
              contentEditable={<ContentEditable className="editor-surface" aria-label="Freemarker template editor" />}
              placeholder={<div className="editor-placeholder">Author a template here...</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <OnChangePlugin
              onChange={(nextEditorState: EditorState, nextEditor: LexicalEditor) => {
                nextEditorState.read(() => {
                  setEditorText($getRoot().getTextContent());
                });
                setEditor(nextEditor);
              }}
            />
          </LexicalComposer>
        </section>

        <section className="card card-controls">
          <div className="card-heading">
            <div>
              <h2>Conditional Controls</h2>
              <p>Edit the MVP node settings, body, else body, and fallback class map preset.</p>
            </div>
          </div>

          <div className="control-grid">
            <label>
              <span>Class preset</span>
              <select value={preset} onChange={(event) => setPreset(event.target.value as keyof typeof CLASS_PRESETS)}>
                <option value="atelier">Atelier</option>
                <option value="terminal">Terminal</option>
                <option value="paper">Paper</option>
              </select>
            </label>
            <label>
              <span>If expression</span>
              <textarea value={ifExpression} onChange={(event) => setIfExpression(event.target.value)} rows={3} />
            </label>
            <label>
              <span>Content</span>
              <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={4} />
            </label>
            <label>
              <span>Else content</span>
              <textarea value={elseContent} onChange={(event) => setElseContent(event.target.value)} rows={4} />
            </label>
          </div>
        </section>

        <section className="card card-preview">
          <div className="card-heading">
            <div>
              <h2>Fallback Settings Preview</h2>
              <p>Rendered from the factory’s raw HTML fallback so class-map changes stay visible.</p>
            </div>
          </div>
          <div className="preview-shell" dangerouslySetInnerHTML={{ __html: previewMarkup }} />
        </section>

        <section className="card card-output">
          <div className="card-heading">
            <div>
              <h2>Serialized Output</h2>
              <p>Insertion preview from the model serializer plus the live editor contents.</p>
            </div>
          </div>
          <div className="output-stack">
            <article>
              <h3>Conditional snippet</h3>
              <pre>{insertionSnippet}</pre>
            </article>
            <article>
              <h3>Editor template</h3>
              <pre>{editorText}</pre>
            </article>
          </div>
        </section>

        <section className="card card-diagnostics">
          <div className="card-heading">
            <div>
              <h2>Diagnostics</h2>
              <p>Parser/plugin messages from live editor updates.</p>
            </div>
          </div>
          {diagnostics.length === 0 ? (
            <p className="empty-state">No diagnostics. Miraculously professional.</p>
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

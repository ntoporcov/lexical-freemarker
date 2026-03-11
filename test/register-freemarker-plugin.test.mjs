import test from 'node:test';
import assert from 'node:assert/strict';

import lexical from '/Users/mininic/LexicalFreemarker/node_modules/lexical/Lexical.js';
import {
  FreemarkerTemplatePlugin,
  createIfNodeFactory,
  registerFreemarkerPlugin,
} from '../dist/index.js';

const { $createParagraphNode, $createTextNode, $getRoot, createEditor } = lexical;

test('FreemarkerTemplatePlugin emits tokens and full parse results', () => {
  const calls = [];
  const plugin = new FreemarkerTemplatePlugin({
    onTokens(tokens) {
      calls.push(['tokens', tokens.length]);
    },
    onParse(result) {
      calls.push(['parse', result.diagnostics.length]);
    },
  });

  const tokens = plugin.parse('<#if user.age > 18>Adult</#if>');

  assert.equal(tokens.filter((token) => token.kind === 'directive').length, 2);
  assert.deepEqual(calls, [
    ['tokens', tokens.length],
    ['parse', 0],
  ]);
});

test('registerFreemarkerPlugin registers factories and emits diagnostics on updates', async () => {
  const factory = createIfNodeFactory();
  const editor = createEditor({ nodes: [factory.nodeClass] });
  const diagnostics = [];

  const cleanup = registerFreemarkerPlugin(editor, {
    factories: [factory],
    onDiagnostics(nextDiagnostics) {
      diagnostics.push(nextDiagnostics);
    },
  });

  await new Promise((resolve) => {
    editor.update(() => {
      const root = $getRoot();
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode('<#else> stray'));
      root.append(paragraph);
    }, { onUpdate: resolve });
  });

  cleanup();

  assert.equal(diagnostics.length > 0, true);
  assert.equal(diagnostics.at(-1)?.[0]?.code, 'stray-else-directive');
});

test('if factory register fails fast when editor is missing node class', () => {
  const factory = createIfNodeFactory();
  const editor = createEditor();

  assert.throws(() => factory.register(editor), /missing the freemarker-if node/);
});

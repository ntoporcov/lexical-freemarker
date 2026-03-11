import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createIfNodeFactory,
  parseIfBlock,
  serializeIfNode,
} from '../dist/index.js';

test('serializeIfNode is deterministic for identical models', () => {
  const model = {
    kind: 'if',
    settings: { ifExpression: 'user.age > 18' },
    contentNodeKeys: ['adult'],
    elseContentNodeKeys: ['minor'],
  };
  const ctx = {
    newline: '\n',
    indent: (depth) => '  '.repeat(depth),
    resolveNodeKey: (nodeKey) => ({ adult: 'Adult', minor: 'Minor' })[nodeKey] ?? '',
  };

  const first = serializeIfNode(model, ctx);
  const second = serializeIfNode(model, ctx);

  assert.equal(
    first,
    ['<#if user.age > 18>', '  Adult', '<#else>', '  Minor', '</#if>'].join('\n'),
  );
  assert.equal(first, second);
});

test('createIfNodeFactory honors serializer overrides and class map overrides', () => {
  const factory = createIfNodeFactory({
    type: 'custom-if',
    ui: {
      classes: { panel: 'panel-base', input: 'input-base' },
      perNodeClasses: { 'custom-if': { input: 'input-node', errorText: 'error-node' } },
    },
    toFreemarker: (node) => `IF:${node.settings.ifExpression}`,
  });

  assert.equal(factory.nodeType, 'custom-if');
  assert.equal(factory.serializeNode({ kind: 'if', settings: { ifExpression: 'ready' }, contentNodeKeys: [] }, {
    newline: '\n',
    indent: () => '',
  }), 'IF:ready');
  assert.deepEqual(factory.getUiClasses(), {
    panel: 'panel-base',
    section: 'fm-section',
    label: 'fm-label',
    input: 'input-node',
    textarea: 'fm-textarea',
    helpText: 'fm-help-text',
    button: 'fm-button',
    buttonPrimary: 'fm-button-primary',
    buttonDanger: 'fm-button-danger',
    row: 'fm-row',
    column: 'fm-column',
    errorText: 'error-node',
  });
});

test('fallback settings panel renders raw HTML with styling hooks', () => {
  const factory = createIfNodeFactory();
  const html = factory.renderSettingsPanel({
    value: { ifExpression: 'user.age > 18' },
    onChange: () => {},
    classes: factory.getUiClasses(),
    diagnostics: [{
      code: 'x',
      message: 'Problem here',
      severity: 'error',
      start: 0,
      end: 1,
    }],
  });

  assert.equal(typeof html, 'string');
  assert.match(html, /data-fm-node="freemarker-if"/);
  assert.match(html, /fm-panel/);
  assert.match(html, /Problem here/);
  assert.match(html, /user\.age &gt; 18/);
});

test('parseIfBlock round-trips serialized content without truncating > operators', () => {
  const template = [
    '<#if user.age > 18 && user.age <= 65>',
    '  Adult',
    '<#else>',
    '  Minor',
    '</#if>',
  ].join('\n');

  const parsed = parseIfBlock(template);

  assert.equal(parsed.settings.ifExpression, 'user.age > 18 && user.age <= 65');
  assert.equal(parsed.content, 'Adult');
  assert.equal(parsed.elseContent, 'Minor');
});

test('parseIfBlock handles nested conditionals and body text with > characters', () => {
  const template = [
    '<#if outer > 1>',
    '  prefix > suffix',
    '  <#if inner > 2>',
    '    nested',
    '  </#if>',
    '</#if>',
  ].join('\n');

  const parsed = parseIfBlock(template);

  assert.equal(parsed.settings.ifExpression, 'outer > 1');
  assert.match(parsed.content, /prefix > suffix/);
  assert.match(parsed.content, /<#if inner > 2>/);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findIfDirectiveEnd,
  getIfExpression,
  parseDirectiveHead,
  parseTemplate,
  validateIfExpression,
} from '../dist/index.js';

function directiveTokens(template) {
  return parseTemplate(template).tokens.filter((token) => token.kind === 'directive');
}

test('validateIfExpression accepts comparison-heavy expressions', () => {
  assert.equal(validateIfExpression('(user.age > 18) && score <= 20'), true);
  assert.equal(validateIfExpression('user.name == ">boss<" || user.name == "minor"'), true);
  assert.equal(validateIfExpression(''), false);
});

test('parseDirectiveHead supports assign grammar with raw > operators', () => {
  const parsed = parseDirectiveHead('<#assign isAdult = user.age > 18>');

  assert.equal(parsed.valid, true);
  assert.deepEqual(parsed.head?.assignments, [{ name: 'isAdult', expression: 'user.age > 18' }]);
});

test('parseDirectiveHead supports list and macro grammar', () => {
  const list = parseDirectiveHead('<#list users as user>');
  const macro = parseDirectiveHead('<#macro badge label color="red">');

  assert.equal(list.valid, true);
  assert.equal(list.head?.expression, 'users');
  assert.equal(list.head?.loopVariable, 'user');

  assert.equal(macro.valid, true);
  assert.equal(macro.head?.macroName, 'badge');
  assert.deepEqual(macro.head?.params, ['label', 'color="red"']);
});

test('parseTemplate preserves > inside if expressions', () => {
  const template = `<#if user.age > 18>\nAdult\n<#else>\nMinor\n</#if>`;
  const directives = directiveTokens(template);

  assert.equal(directives[0].value, '<#if user.age > 18>');
  assert.equal(getIfExpression(directives[0].value), 'user.age > 18');
  assert.deepEqual(
    directives.map((token) => token.value),
    ['<#if user.age > 18>', '<#else>', '</#if>'],
  );
});

test('parseTemplate keeps >= and <= operators intact', () => {
  const template = `<#if score >= 10 && score <= 20>\nMid\n</#if>`;
  const directives = directiveTokens(template);

  assert.equal(directives[0].value, '<#if score >= 10 && score <= 20>');
  assert.equal(getIfExpression(directives[0].value), 'score >= 10 && score <= 20');
});

test('parseTemplate keeps < and <= operators intact', () => {
  const template = `<#if temperature < 0 || temperature <= 3>\nCold\n</#if>`;
  const directives = directiveTokens(template);

  assert.equal(directives[0].value, '<#if temperature < 0 || temperature <= 3>');
  assert.equal(getIfExpression(directives[0].value), 'temperature < 0 || temperature <= 3');
});

test('parseTemplate handles quoted operators inside if expressions', () => {
  const template = `<#if user.name == ">boss<" || user.name == '\'boss\''>\nHi\n</#if>`;
  const directives = directiveTokens(template);

  assert.equal(
    directives[0].value,
    `<#if user.name == ">boss<" || user.name == '\'boss\''>`,
  );
  assert.equal(
    getIfExpression(directives[0].value),
    `user.name == ">boss<" || user.name == '\'boss\''`,
  );
});

test('parseTemplate tolerates > inside interpolation and body text', () => {
  const template = `<#if user.age > 18>\nValue: ${'${user.age > 18}'}\nA > B\n</#if>`;
  const result = parseTemplate(template);

  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.tokens.filter((token) => token.kind === 'interpolation').length, 1);
  assert.equal(result.tokens.filter((token) => token.kind === 'directive').length, 2);
});

test('parseTemplate reports malformed conditional structures', () => {
  const missingClose = parseTemplate('<#if ready>\nHello');
  assert.match(missingClose.diagnostics[0].code, /unclosed-if-directive|unclosed-directive/);

  const emptyExpression = parseTemplate('<#if >\nHello\n</#if>');
  assert.equal(emptyExpression.diagnostics[0].code, 'malformed-directive-shape');

  const strayElse = parseTemplate('<#else>\nOops');
  assert.equal(strayElse.diagnostics[0].code, 'stray-else-directive');
});

test('parseTemplate reports mismatched close tags for other block directives too', () => {
  const result = parseTemplate('<#list users as user>\n  ${user}\n</#if>');
  assert.equal(
    result.diagnostics.some((diagnostic) => diagnostic.code === 'mismatched-directive-close'),
    true,
  );
});

test('findIfDirectiveEnd chooses the correct delimiter when > appears in the expression', () => {
  const input = '<#if user.age > 18>';
  assert.equal(findIfDirectiveEnd(input, 0), input.length);
});

import {
  $applyNodeReplacement,
  ElementNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
} from 'lexical';

import { findIfDirectiveEnd } from '../parser/parseTemplate.js';
import type {
  CreateIfNodeFactoryOptions,
  FreemarkerSerializeContext,
  FreemarkerSettingsPanelComponent,
  FreemarkerUiClassMap,
  IfNodeFactory,
  IfNodeModel,
  IfNodeSettings,
  ParsedIfBlock,
  SerializedIfNode,
  SettingsRenderProps,
} from '../types.js';

const DEFAULT_IF_NODE_TYPE = 'freemarker-if';

const DEFAULT_UI_CLASSES: FreemarkerUiClassMap = {
  panel: 'fm-panel',
  section: 'fm-section',
  label: 'fm-label',
  input: 'fm-input',
  textarea: 'fm-textarea',
  helpText: 'fm-help-text',
  button: 'fm-button',
  buttonPrimary: 'fm-button-primary',
  buttonDanger: 'fm-button-danger',
  row: 'fm-row',
  column: 'fm-column',
  errorText: 'fm-error-text',
};

export function createIfNodeFactory(options: CreateIfNodeFactoryOptions = {}): IfNodeFactory {
  const nodeType = options.type ?? DEFAULT_IF_NODE_TYPE;
  const classes = resolveUiClasses(nodeType, options);
  const renderSettingsPanel = options.renderSettingsPanel ?? createFallbackIfSettingsPanel(nodeType);
  const IfNodeClass = createIfNodeClass(nodeType);

  return {
    nodeType,
    nodeClass: IfNodeClass,
    createInitialNode() {
      return $createIfNode(IfNodeClass, { ifExpression: '' });
    },
    register(editor: LexicalEditor) {
      if (!editor.hasNodes([IfNodeClass])) {
        throw new Error(
          `Lexical editor is missing the ${nodeType} node. Add the factory's nodeClass to editor nodes.`,
        );
      }

      return () => {
        // Reserved for future command registration. MVP only validates node availability.
      };
    },
    serializeNode(node: IfNodeModel, ctx: FreemarkerSerializeContext) {
      return options.toFreemarker?.(node, ctx) ?? serializeIfNode(node, ctx);
    },
    renderSettingsPanel,
    getUiClasses() {
      return { ...classes };
    },
  };
}

export function serializeIfNode(node: IfNodeModel, ctx: FreemarkerSerializeContext): string {
  const newline = ctx.newline;
  const escapedExpression = ctx.escapeExpression
    ? ctx.escapeExpression(node.settings.ifExpression)
    : node.settings.ifExpression;

  const parts = [`<#if ${escapedExpression}>`];
  const primaryContent = resolveNodeKeyContent(node.contentNodeKeys, ctx);
  const elseContent = resolveNodeKeyContent(node.elseContentNodeKeys ?? [], ctx);

  if (primaryContent.length > 0) {
    parts.push(indentBlock(primaryContent, ctx, 1));
  }

  if (node.elseContentNodeKeys && node.elseContentNodeKeys.length > 0) {
    parts.push('<#else>');
    if (elseContent.length > 0) {
      parts.push(indentBlock(elseContent, ctx, 1));
    }
  }

  parts.push('</#if>');
  return parts.join(newline);
}

export function parseIfBlock(template: string): ParsedIfBlock {
  const trimmed = template.trim();
  if (!trimmed.startsWith('<#if')) {
    throw new Error('Conditional block must start with <#if ...>.');
  }

  const openEnd = findIfDirectiveEnd(trimmed, 0);
  if (openEnd === -1) {
    throw new Error('Conditional block is missing the opening directive terminator.');
  }

  const openTag = trimmed.slice(0, openEnd);
  const expression = openTag.replace(/^<#if\s*/, '').replace(/>$/, '').trim();
  const bodyStart = openEnd;
  const topLevelElseIndex = findTopLevelMarker(trimmed, bodyStart, '<#else>');
  const closingIndex = findTopLevelMarker(trimmed, bodyStart, '</#if>');

  if (closingIndex === -1) {
    throw new Error('Conditional block is missing </#if>.');
  }

  const content = trimmed
    .slice(bodyStart, topLevelElseIndex === -1 ? closingIndex : topLevelElseIndex)
    .trim();
  const elseContent =
    topLevelElseIndex === -1
      ? undefined
      : trimmed.slice(topLevelElseIndex + '<#else>'.length, closingIndex).trim();

  return {
    kind: 'if',
    settings: { ifExpression: expression },
    content,
    elseContent,
  };
}

export function createFallbackIfSettingsPanel(
  nodeType: string,
): FreemarkerSettingsPanelComponent<IfNodeSettings> {
  return function renderFallbackIfSettingsPanel(
    props: SettingsRenderProps<IfNodeSettings>,
  ): string {
    const diagnostics = props.diagnostics ?? [];
    const diagnosticMarkup = diagnostics.length
      ? `<div class="${props.classes.errorText ?? ''}">${diagnostics
          .map((diagnostic) => escapeHtml(diagnostic.message))
          .join('<br />')}</div>`
      : '';

    return [
      `<section class="${props.classes.panel ?? ''}" data-fm-node="${nodeType}">`,
      `  <div class="${props.classes.section ?? ''}">`,
      `    <div class="${props.classes.row ?? ''}">`,
      `      <label class="${props.classes.label ?? ''}" for="${nodeType}-ifExpression">If expression</label>`,
      '    </div>',
      `    <div class="${props.classes.column ?? ''}">`,
      `      <input id="${nodeType}-ifExpression" class="${props.classes.input ?? ''}" name="ifExpression" value="${escapeHtml(
        props.value.ifExpression,
      )}" />`,
      `      <p class="${props.classes.helpText ?? ''}">Raw Freemarker condition. Example: user.age &gt;= 18</p>`,
      diagnosticMarkup,
      '    </div>',
      '  </div>',
      '</section>',
    ].join('\n');
  };
}

export function createIfNodeClass(nodeType: string) {
  return class IfNode extends ElementNode {
    __ifExpression: string;

    static getType(): string {
      return nodeType;
    }

    static clone(node: IfNode): IfNode {
      return new IfNode(node.__ifExpression, node.__key);
    }

    static importJSON(serializedNode: SerializedIfNode): IfNode {
      return new IfNode(serializedNode.ifExpression);
    }

    constructor(ifExpression = '', key?: NodeKey) {
      super(key);
      this.__ifExpression = ifExpression;
    }

    createDOM(config: EditorConfig): HTMLElement {
      const element = document.createElement('section');
      const themeClass = (config.theme as Record<string, string | undefined> | undefined)?.[nodeType];
      if (themeClass) {
        element.className = themeClass;
      }
      element.dataset.freemarkerNode = nodeType;
      return element;
    }

    updateDOM(): false {
      return false;
    }

    exportJSON(): SerializedIfNode {
      return {
        ...super.exportJSON(),
        ifExpression: this.getIfExpression(),
        type: nodeType,
        version: 1,
      };
    }

    getIfExpression(): string {
      return (this.getLatest() as IfNode).__ifExpression;
    }

    setIfExpression(ifExpression: string): this {
      const writable = this.getWritable() as IfNode;
      writable.__ifExpression = ifExpression;
      return writable as this;
    }

    canBeEmpty(): true {
      return true;
    }
  };
}

export function $createIfNode(
  IfNodeClass: new (ifExpression?: string, key?: NodeKey) => LexicalNode,
  settings: IfNodeSettings,
): LexicalNode {
  return $applyNodeReplacement(new IfNodeClass(settings.ifExpression));
}

function resolveUiClasses(nodeType: string, options: CreateIfNodeFactoryOptions): FreemarkerUiClassMap {
  return {
    ...DEFAULT_UI_CLASSES,
    ...options.ui?.classes,
    ...options.ui?.perNodeClasses?.[nodeType],
  };
}

function resolveNodeKeyContent(nodeKeys: string[], ctx: FreemarkerSerializeContext): string {
  if (nodeKeys.length === 0) {
    return '';
  }

  return nodeKeys
    .map((nodeKey) => ctx.resolveNodeKey?.(nodeKey) ?? '')
    .filter((value) => value.length > 0)
    .join(ctx.newline);
}

function indentBlock(content: string, ctx: FreemarkerSerializeContext, depth: number): string {
  const indent = ctx.indent(depth);
  return content
    .split(/\r?\n/)
    .map((line) => `${indent}${line}`)
    .join(ctx.newline);
}

function findTopLevelMarker(template: string, startIndex: number, target: '<#else>' | '</#if>'): number {
  let index = startIndex;
  let depth = 0;

  while (index < template.length) {
    if (template.startsWith('${', index)) {
      index = skipBalancedInterpolation(template, index);
      continue;
    }

    if (template.startsWith('<#--', index)) {
      const commentEnd = template.indexOf('-->', index + 4);
      index = commentEnd === -1 ? template.length : commentEnd + 3;
      continue;
    }

    if (template.startsWith('<#if', index)) {
      depth += 1;
      const next = findIfDirectiveEnd(template, index);
      index = next === -1 ? template.length : next;
      continue;
    }

    if (template.startsWith('</#if>', index)) {
      if (depth === 0 && target === '</#if>') {
        return index;
      }

      depth = Math.max(0, depth - 1);
      index += '</#if>'.length;
      continue;
    }

    if (template.startsWith('<#else>', index)) {
      if (depth === 0 && target === '<#else>') {
        return index;
      }

      index += '<#else>'.length;
      continue;
    }

    index += 1;
  }

  return -1;
}

function skipBalancedInterpolation(template: string, start: number): number {
  let index = start + 2;
  let depth = 1;
  let quote: string | null = null;

  while (index < template.length) {
    const char = template[index];
    const previous = template[index - 1];

    if (quote !== null) {
      if (char === quote && previous !== '\\') {
        quote = null;
      }
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      index += 1;
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }

    index += 1;
  }

  return template.length;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

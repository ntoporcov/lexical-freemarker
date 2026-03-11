import type { JSX } from 'react';

import {
  $applyNodeReplacement,
  $getNodeByKey,
  DecoratorNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';

import { parseTemplate, serializeIfNode } from '@mininic-nt/lexical-freemarker';

import { IfCardComponent } from '../plugins/IfCardComponent';

export type SerializedIfCardNode = Spread<{
  condition: string;
  content: string;
  elseContent: string;
  hasElse: boolean;
  errorMessage: string | null;
}, SerializedLexicalNode>;

export class IfCardNode extends DecoratorNode<JSX.Element> {
  __condition: string;
  __content: string;
  __elseContent: string;
  __hasElse: boolean;
  __errorMessage: string | null;

  static getType(): string {
    return 'tester-if-card';
  }

  static clone(node: IfCardNode): IfCardNode {
    return new IfCardNode(
      node.__condition,
      node.__content,
      node.__elseContent,
      node.__hasElse,
      node.__errorMessage,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedIfCardNode): IfCardNode {
    return new IfCardNode(
      serializedNode.condition,
      serializedNode.content,
      serializedNode.elseContent,
      serializedNode.hasElse,
      serializedNode.errorMessage,
    );
  }

  constructor(
    condition = 'user.age > 18',
    content = 'Adult',
    elseContent = 'Minor',
    hasElse = true,
    errorMessage: string | null = null,
    key?: NodeKey,
  ) {
    super(key);
    this.__condition = condition;
    this.__content = content;
    this.__elseContent = elseContent;
    this.__hasElse = hasElse;
    this.__errorMessage = errorMessage;
  }

  exportJSON(): SerializedIfCardNode {
    return {
      ...super.exportJSON(),
      type: 'tester-if-card',
      version: 1,
      condition: this.getCondition(),
      content: this.getContent(),
      elseContent: this.getElseContent(),
      hasElse: this.getHasElse(),
      errorMessage: this.getErrorMessage(),
    };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    element.className = 'if-card-shell';
    return element;
  }

  updateDOM(): false {
    return false;
  }

  decorate(_editor: LexicalEditor): JSX.Element {
    return <IfCardComponent nodeKey={this.__key} />;
  }

  isInline(): false {
    return false;
  }

  isIsolated(): true {
    return true;
  }

  isKeyboardSelectable(): true {
    return true;
  }

  getCondition(): string {
    return (this.getLatest() as IfCardNode).__condition;
  }

  getContent(): string {
    return (this.getLatest() as IfCardNode).__content;
  }

  getElseContent(): string {
    return (this.getLatest() as IfCardNode).__elseContent;
  }

  getHasElse(): boolean {
    return (this.getLatest() as IfCardNode).__hasElse;
  }

  getErrorMessage(): string | null {
    return (this.getLatest() as IfCardNode).__errorMessage;
  }

  setCondition(condition: string): this {
    const writable = this.getWritable() as IfCardNode;
    writable.__condition = condition;
    return writable as this;
  }

  setContent(content: string): this {
    const writable = this.getWritable() as IfCardNode;
    writable.__content = content;
    return writable as this;
  }

  setElseContent(elseContent: string): this {
    const writable = this.getWritable() as IfCardNode;
    writable.__elseContent = elseContent;
    return writable as this;
  }

  setHasElse(hasElse: boolean): this {
    const writable = this.getWritable() as IfCardNode;
    writable.__hasElse = hasElse;
    return writable as this;
  }

  setErrorMessage(errorMessage: string | null): this {
    const writable = this.getWritable() as IfCardNode;
    writable.__errorMessage = errorMessage;
    return writable as this;
  }
}

export function $createIfCardNode(settings?: {
  condition?: string;
  content?: string;
  elseContent?: string;
  hasElse?: boolean;
  errorMessage?: string | null;
}): IfCardNode {
  const node = new IfCardNode(
    settings?.condition,
    settings?.content,
    settings?.elseContent,
    settings?.hasElse,
    settings?.errorMessage,
  );
  node.setErrorMessage(validateIfCardState({
    condition: node.getCondition(),
    content: node.getContent(),
    elseContent: node.getElseContent(),
    hasElse: node.getHasElse(),
    errorMessage: node.getErrorMessage(),
  }));
  return $applyNodeReplacement(node);
}

export function $isIfCardNode(node: LexicalNode | null | undefined): node is IfCardNode {
  return node instanceof IfCardNode;
}

export function $updateIfCardNode(
  nodeKey: NodeKey,
  patch: Partial<{ condition: string; content: string; elseContent: string; hasElse: boolean; errorMessage: string | null }>,
): void {
  const node = $getNodeByKey(nodeKey);
  if (!$isIfCardNode(node)) {
    return;
  }

  if (patch.condition !== undefined) {
    node.setCondition(patch.condition);
  }
  if (patch.content !== undefined) {
    node.setContent(patch.content);
  }
  if (patch.elseContent !== undefined) {
    node.setElseContent(patch.elseContent);
  }
  if (patch.hasElse !== undefined) {
    node.setHasElse(patch.hasElse);
  }
  const errorMessage = patch.errorMessage ?? validateIfCardState({
    condition: node.getCondition(),
    content: node.getContent(),
    elseContent: node.getElseContent(),
    hasElse: node.getHasElse(),
    errorMessage: node.getErrorMessage(),
  });
  node.setErrorMessage(errorMessage);
}

export function validateIfCardState(state: {
  condition: string;
  content: string;
  elseContent: string;
  hasElse: boolean;
  errorMessage?: string | null;
}): string | null {
  if (state.condition.trim().length === 0) {
    return 'Condition is required.';
  }

  const output = serializeIfNode(
    {
      kind: 'if',
      settings: { ifExpression: state.condition },
      contentNodeKeys: ['then'],
      elseContentNodeKeys: state.hasElse ? ['else'] : undefined,
    },
    {
      newline: '\n',
      indent: (depth) => '  '.repeat(depth),
      resolveNodeKey(nodeKey) {
        if (nodeKey === 'then') {
          return state.content;
        }
        if (nodeKey === 'else') {
          return state.elseContent;
        }
        return '';
      },
    },
  );

  const diagnostics = parseTemplate(output).diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  return diagnostics[0]?.message ?? null;
}

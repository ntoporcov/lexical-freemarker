import {
  $isElementNode,
  $isLineBreakNode,
  $isTextNode,
  type EditorState,
  type LexicalNode,
} from 'lexical';
import { $isHeadingNode, $isQuoteNode, type HeadingNode, type QuoteNode } from '@lexical/rich-text';
import { $isListItemNode, $isListNode, type ListItemNode, type ListNode } from '@lexical/list';

import { serializeIfNode } from '@mininic-nt/lexical-freemarker';
import { $isIfCardNode, type IfCardNode } from '../nodes/IfCardNode';

export function serializeEditorDocument(editorState: EditorState): string {
  let output = '';

  editorState.read(() => {
    const root = editorState._nodeMap.get('root');
    if (!root || !('getChildren' in root) || typeof root.getChildren !== 'function') {
      output = '';
      return;
    }

    const blocks = (root as { getChildren: () => LexicalNode[] }).getChildren()
      .map((node) => serializeBlock(node))
      .filter((value): value is string => value.length > 0);
    output = blocks.join('\n\n');
  });

  return output;
}

function serializeBlock(node: LexicalNode): string {
  if ($isIfCardNode(node)) {
    return serializeIfCard(node);
  }

  if ($isHeadingNode(node)) {
    return serializeChildren(node.getChildren());
  }

  if ($isQuoteNode(node)) {
    const content = serializeChildren(node.getChildren());
    return content
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
  }

  if ($isListNode(node)) {
    return serializeList(node);
  }

  if ($isElementNode(node)) {
    return serializeChildren(node.getChildren());
  }

  if ($isTextNode(node)) {
    return node.getTextContent();
  }

  return '';
}

function serializeIfCard(node: IfCardNode): string {
  return serializeIfNode(
    {
      kind: 'if',
      settings: { ifExpression: node.getCondition() },
      contentNodeKeys: ['then'],
      elseContentNodeKeys: node.getHasElse() ? ['else'] : undefined,
    },
    {
      newline: '\n',
      indent: (depth) => '  '.repeat(depth),
      resolveNodeKey(nodeKey) {
        if (nodeKey === 'then') {
          return node.getContent();
        }
        if (nodeKey === 'else') {
          return node.getElseContent();
        }
        return '';
      },
    },
  );
}

function serializeList(listNode: ListNode): string {
  return listNode
    .getChildren()
    .filter($isListItemNode)
    .map((item, index) => serializeListItem(item, listNode, index))
    .join('\n');
}

function serializeListItem(item: ListItemNode, listNode: ListNode, index: number): string {
  const prefix = listNode.getListType() === 'number' ? `${index + 1}. ` : '- ';
  return `${prefix}${serializeChildren(item.getChildren())}`;
}

function serializeChildren(nodes: LexicalNode[]): string {
  return nodes.map((node) => serializeInline(node)).join('');
}

function serializeInline(node: LexicalNode): string {
  if ($isTextNode(node)) {
    return node.getTextContent();
  }

  if ($isLineBreakNode(node)) {
    return '\n';
  }

  if ($isIfCardNode(node)) {
    return serializeIfCard(node);
  }

  if ($isElementNode(node)) {
    return serializeChildren(node.getChildren());
  }

  return '';
}

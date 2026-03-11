import {
  $parseSerializedNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isElementNode,
  $isLineBreakNode,
  $isTextNode,
  createEditor,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
  type TextNode,
} from 'lexical';
import { $generateNodesFromDOM } from '@lexical/html';
import { $convertFromMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { $isHeadingNode, $isQuoteNode, HeadingNode, QuoteNode, type HeadingNode as HeadingNodeType } from '@lexical/rich-text';
import { $isListItemNode, $isListNode, ListItemNode, ListNode, type ListItemNode as ListItemNodeType, type ListNode as ListNodeType } from '@lexical/list';

import { parseIfBlock, serializeIfNode } from '@mininic-nt/lexical-freemarker';
import { $createIfCardNode, $isIfCardNode, type IfCardNode } from '../nodes/IfCardNode';

export type OutputFormat = 'plain' | 'markdown' | 'html';
export type ImportStatus = 'success' | 'partial' | 'error';

export type ImportResult = {
  status: ImportStatus;
  importedBlockCount: number;
  richTextBlockCount: number;
  freemarkerBlockCount: number;
  freemarkerErrorCount: number;
  message: string;
};

export function exportEditorDocument(editorState: EditorState, format: OutputFormat): string {
  let output = '';

  editorState.read(() => {
    const root = $getRoot();
    const blocks = root
      .getChildren()
      .map((node) => serializeBlock(node, format))
      .filter((value): value is string => value.length > 0);
    output = blocks.join(format === 'html' ? '\n' : '\n\n');
  });

  return output;
}

export async function importEditorDocument(
  editor: LexicalEditor,
  input: string,
  format: OutputFormat,
): Promise<ImportResult> {
  const blocks = await importBlocks(input, format);

  await new Promise<void>((resolve) => {
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      const nodes = blocks.flatMap((block) =>
        block.type === 'nodes'
          ? block.nodes.map((node) => $parseSerializedNode(node as never))
          : [
              $createIfCardNode({
                condition: block.condition,
                content: block.content,
                elseContent: block.elseContent,
                hasElse: block.hasElse,
                errorMessage: block.errorMessage,
              }),
            ],
      );

      if (nodes.length === 0) {
        root.append($createParagraphNode());
      } else {
        root.append(...nodes);
      }
    }, { onUpdate: () => resolve() });
  });

  const richTextBlockCount = blocks.filter((block) => block.type === 'nodes').length;
  const freemarkerBlocks = blocks.filter((block): block is Extract<ImportedBlock, { type: 'if' }> => block.type === 'if');
  const freemarkerErrorCount = freemarkerBlocks.filter((block) => block.errorMessage).length;
  const successfulBlockCount = blocks.length - freemarkerErrorCount;
  const status: ImportStatus = freemarkerErrorCount === 0 ? 'success' : successfulBlockCount > 0 ? 'partial' : 'error';

  return {
    status,
    importedBlockCount: blocks.length,
    richTextBlockCount,
    freemarkerBlockCount: freemarkerBlocks.length,
    freemarkerErrorCount,
    message: buildImportMessage(status, blocks.length, freemarkerErrorCount),
  };
}

export function serializeIfCardNode(node: IfCardNode): string {
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

type ImportedBlock =
  | { type: 'nodes'; nodes: Array<Record<string, unknown>> }
  | { type: 'if'; condition: string; content: string; elseContent: string; hasElse: boolean; errorMessage: string | null };

type SplitSegment = {
  type: 'text' | 'if';
  content: string;
  importError: string | null;
};

async function importBlocks(input: string, format: OutputFormat): Promise<ImportedBlock[]> {
  const segments = splitFreemarkerIfBlocks(input);
  const imported: ImportedBlock[] = [];

  for (const segment of segments) {
    if (segment.type === 'if') {
      if (segment.importError) {
        imported.push({
          type: 'if',
          condition: '',
          content: segment.content,
          elseContent: '',
          hasElse: false,
          errorMessage: segment.importError,
        });
        continue;
      }

      try {
        const parsed = parseIfBlock(segment.content);
        imported.push({
          type: 'if',
          condition: parsed.settings.ifExpression,
          content: parsed.content,
          elseContent: parsed.elseContent ?? '',
          hasElse: parsed.elseContent !== undefined,
          errorMessage: null,
        });
      } catch (error) {
        imported.push({
          type: 'if',
          condition: '',
          content: segment.content,
          elseContent: '',
          hasElse: false,
          errorMessage: formatFreemarkerError(error),
        });
      }
      continue;
    }

    if (segment.content.trim().length === 0) {
      continue;
    }

    imported.push({ type: 'nodes', nodes: await importRichTextSegment(segment.content, format) });
  }

  return imported;
}

function buildImportMessage(status: ImportStatus, blockCount: number, freemarkerErrorCount: number): string {
  if (status === 'success') {
    return `Import complete. Parsed ${blockCount} block${blockCount === 1 ? '' : 's'} into Lexical.`;
  }

  if (status === 'partial') {
    return `Partial import. ${freemarkerErrorCount} Freemarker block${freemarkerErrorCount === 1 ? '' : 's'} stayed in error cards.`;
  }

  return `Import failed cleanly. ${freemarkerErrorCount} Freemarker block${freemarkerErrorCount === 1 ? '' : 's'} stayed in error cards.`;
}

function formatFreemarkerError(error: unknown): string {
  const detail = error instanceof Error ? error.message : 'Failed to parse Freemarker block.';
  return `Freemarker block error: ${detail}`;
}

async function importRichTextSegment(input: string, format: OutputFormat): Promise<Array<Record<string, unknown>>> {
  if (format === 'plain') {
    return importPlainText(input);
  }

  if (format === 'markdown') {
    return importMarkdown(input);
  }

  return importHtml(input);
}

async function importPlainText(input: string): Promise<Array<Record<string, unknown>>> {
  const editor = createRichTextImportEditor();
  let nodes: Array<Record<string, unknown>> = [];

  await new Promise<void>((resolve) => {
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      input
        .split(/\n\s*\n/)
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .forEach((chunk) => {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(chunk));
          root.append(paragraph);
        });
      nodes = root.getChildren().map((node) => serializeNodeForImport(node));
    }, { onUpdate: () => resolve() });
  });

  return nodes;
}

async function importMarkdown(markdown: string): Promise<Array<Record<string, unknown>>> {
  const editor = createRichTextImportEditor();
  let nodes: Array<Record<string, unknown>> = [];

  await new Promise<void>((resolve) => {
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      $convertFromMarkdownString(markdown, TRANSFORMERS);
      nodes = root.getChildren().map((node) => serializeNodeForImport(node));
    }, { onUpdate: () => resolve() });
  });

  return nodes;
}

async function importHtml(html: string): Promise<Array<Record<string, unknown>>> {
  const editor = createRichTextImportEditor();
  let nodes: Array<Record<string, unknown>> = [];
  const dom = createDomParserDocument(html);

  await new Promise<void>((resolve) => {
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      const generatedNodes = $generateNodesFromDOM(editor, dom);
      root.append(...generatedNodes);
      nodes = root.getChildren().map((node) => serializeNodeForImport(node));
    }, { onUpdate: () => resolve() });
  });

  return nodes;
}

function createRichTextImportEditor(): LexicalEditor {
  return createEditor({ nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode] });
}

function serializeNodeForImport(node: LexicalNode): Record<string, unknown> {
  const serialized = node.exportJSON() as Record<string, unknown>;

  if ($isElementNode(node)) {
    serialized.children = node.getChildren().map((child) => serializeNodeForImport(child));
  }

  return serialized;
}

function createDomParserDocument(html: string): Document {
  if (typeof DOMParser === 'undefined') {
    throw new Error('DOMParser is not available in this environment.');
  }

  return new DOMParser().parseFromString(html, 'text/html');
}

function splitFreemarkerIfBlocks(input: string): SplitSegment[] {
  const segments: SplitSegment[] = [];
  let cursor = 0;

  while (cursor < input.length) {
    const start = input.indexOf('<#if', cursor);
    if (start === -1) {
      segments.push({ type: 'text', content: input.slice(cursor), importError: null });
      break;
    }

    if (start > cursor) {
      segments.push({ type: 'text', content: input.slice(cursor, start), importError: null });
    }

    const end = findIfBlockEnd(input, start);
    if (end === -1) {
      const localizedEnd = findLocalizedMalformedIfEnd(input, start);
      segments.push({
        type: 'if',
        content: input.slice(start, localizedEnd),
        importError: 'Unclosed <#if block. Imported as an error card so the rest of the document stays editable.',
      });
      cursor = localizedEnd;
      continue;
    }

    segments.push({ type: 'if', content: input.slice(start, end), importError: null });
    cursor = end;
  }

  return segments;
}

function findLocalizedMalformedIfEnd(input: string, start: number): number {
  const remainder = input.slice(start);
  const blankLineMatch = /\n\s*\n/.exec(remainder);
  if (blankLineMatch) {
    return start + blankLineMatch.index;
  }
  return input.length;
}

function findIfBlockEnd(input: string, start: number): number {
  let depth = 0;
  let index = start;

  while (index < input.length) {
    if (input.startsWith('<#if', index)) {
      depth += 1;
      index += 4;
      continue;
    }

    if (input.startsWith('</#if>', index)) {
      depth -= 1;
      index += 6;
      if (depth === 0) {
        return index;
      }
      continue;
    }

    index += 1;
  }

  return -1;
}

function serializeBlock(node: LexicalNode, format: OutputFormat): string {
  if ($isIfCardNode(node)) {
    return serializeIfCardNode(node);
  }

  if ($isHeadingNode(node)) {
    return serializeHeading(node, format);
  }

  if ($isQuoteNode(node)) {
    return serializeQuote(node, format);
  }

  if ($isListNode(node)) {
    return serializeList(node, format);
  }

  if ($isElementNode(node)) {
    const content = serializeChildren(node.getChildren(), format);
    return format === 'html' ? `<p>${content}</p>` : content;
  }

  if ($isTextNode(node)) {
    return serializeText(node, format);
  }

  return '';
}

function serializeHeading(node: HeadingNodeType, format: OutputFormat): string {
  const content = serializeChildren(node.getChildren(), format);
  if (format === 'html') {
    return `<${node.getTag()}>${content}</${node.getTag()}>`;
  }
  if (format === 'markdown') {
    const prefix = node.getTag() === 'h1' ? '# ' : '## ';
    return `${prefix}${serializeChildren(node.getChildren(), 'plain')}`;
  }
  return serializeChildren(node.getChildren(), 'plain');
}

function serializeQuote(node: QuoteNode, format: OutputFormat): string {
  const content = serializeChildren(node.getChildren(), format === 'html' ? 'html' : 'plain');
  if (format === 'html') {
    return `<blockquote><p>${content}</p></blockquote>`;
  }
  return content
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

function serializeList(node: ListNodeType, format: OutputFormat): string {
  const items = node
    .getChildren()
    .filter($isListItemNode)
    .map((item, index) => serializeListItem(item, node, index, format));

  if (format === 'html') {
    const tag = node.getListType() === 'number' ? 'ol' : 'ul';
    return `<${tag}>${items.join('')}</${tag}>`;
  }

  return items.join('\n');
}

function serializeListItem(item: ListItemNodeType, listNode: ListNodeType, index: number, format: OutputFormat): string {
  const content = serializeChildren(item.getChildren(), format === 'html' ? 'html' : 'plain');
  if (format === 'html') {
    return `<li>${content}</li>`;
  }
  const prefix = listNode.getListType() === 'number' ? `${index + 1}. ` : '- ';
  return `${prefix}${serializeChildren(item.getChildren(), format === 'markdown' ? 'markdown' : 'plain')}`;
}

function serializeChildren(nodes: LexicalNode[], format: OutputFormat): string {
  return nodes.map((node) => serializeInline(node, format)).join('');
}

function serializeInline(node: LexicalNode, format: OutputFormat): string {
  if ($isTextNode(node)) {
    return serializeText(node, format);
  }

  if ($isLineBreakNode(node)) {
    return format === 'html' ? '<br />' : '\n';
  }

  if ($isIfCardNode(node)) {
    return serializeIfCardNode(node);
  }

  if ($isElementNode(node)) {
    return serializeChildren(node.getChildren(), format);
  }

  return '';
}

function serializeText(node: TextNode, format: OutputFormat): string {
  const text = escapeText(node.getTextContent(), format);

  if (format === 'html') {
    let html = text;
    if (node.hasFormat('bold')) {
      html = `<strong>${html}</strong>`;
    }
    if (node.hasFormat('italic')) {
      html = `<em>${html}</em>`;
    }
    return html;
  }

  if (format === 'markdown') {
    let md = text;
    if (node.hasFormat('bold')) {
      md = `**${md}**`;
    }
    if (node.hasFormat('italic')) {
      md = `*${md}*`;
    }
    return md;
  }

  return text;
}

function escapeText(value: string, format: OutputFormat): string {
  if (format === 'html') {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  return value;
}

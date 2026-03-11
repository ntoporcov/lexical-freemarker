import { describe, expect, it } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, createEditor } from 'lexical';
import { $createHeadingNode, HeadingNode, QuoteNode } from '@lexical/rich-text';
import { $createListItemNode, $createListNode, ListItemNode, ListNode } from '@lexical/list';

import { IfCardNode, $createIfCardNode } from '../nodes/IfCardNode';
import { serializeEditorDocument } from '../serialization/serializeEditorDocument';

async function withEditorState(build: () => void): Promise<string> {
  const editor = createEditor({ nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, IfCardNode] });
  await new Promise<void>((resolve) => {
    editor.update(() => {
      build();
    }, { onUpdate: () => resolve() });
  });
  return serializeEditorDocument(editor.getEditorState());
}

describe('serializeEditorDocument', () => {
  it('serializes multiple If nodes in a single document', async () => {
    const output = await withEditorState(() => {
      const root = $getRoot();
      root.clear();
      root.append(
        $createIfCardNode({ condition: 'user.age > 18', content: 'Adult', elseContent: 'Minor', hasElse: true }),
        $createIfCardNode({ condition: 'user.vip', content: 'VIP', hasElse: false }),
      );
    });

    expect(output).toContain('<#if user.age > 18>');
    expect(output).toContain('<#else>');
    expect(output).toContain('<#if user.vip>');
  });

  it('serializes mixed rich text and if nodes in order', async () => {
    const output = await withEditorState(() => {
      const root = $getRoot();
      root.clear();
      const heading = $createHeadingNode('h1');
      heading.append($createTextNode('Welcome'));
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode('Intro copy.'));
      root.append(
        heading,
        paragraph,
        $createIfCardNode({ condition: 'user.age >= 18', content: 'Adult', elseContent: 'Minor', hasElse: true }),
      );
    });

    expect(output).toBe([
      'Welcome',
      'Intro copy.',
      ['<#if user.age >= 18>', '  Adult', '<#else>', '  Minor', '</#if>'].join('\n'),
    ].join('\n\n'));
    expect(output.indexOf('Welcome')).toBeLessThan(output.indexOf('<#if user.age >= 18>'));
  });

  it('omits else blocks when the toggle is off', async () => {
    const output = await withEditorState(() => {
      const root = $getRoot();
      root.clear();
      root.append($createIfCardNode({ condition: 'user.active', content: 'Active', elseContent: 'Inactive', hasElse: false }));
    });

    expect(output).toContain('<#if user.active>');
    expect(output).not.toContain('<#else>');
    expect(output).not.toContain('Inactive');
  });

  it('preserves operators in conditions and list serialization', async () => {
    const output = await withEditorState(() => {
      const root = $getRoot();
      root.clear();
      const list = $createListNode('bullet');
      const item = $createListItemNode();
      item.append($createTextNode('First item'));
      list.append(item);
      root.append(
        list,
        $createIfCardNode({ condition: 'score >= 10 && score <= 20', content: 'Mid', elseContent: 'Out', hasElse: true }),
      );
    });

    expect(output).toContain('- First item');
    expect(output).toContain('<#if score >= 10 && score <= 20>');
  });
});

import { describe, expect, it } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, createEditor } from 'lexical';
import { $createHeadingNode, HeadingNode, QuoteNode } from '@lexical/rich-text';
import { $createListItemNode, $createListNode, ListItemNode, ListNode } from '@lexical/list';

import { IfCardNode, $createIfCardNode } from '../nodes/IfCardNode';
import { exportEditorDocument, importEditorDocument } from '../serialization/roundTrip';

async function withEditor(build: () => void) {
  const editor = createEditor({ nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, IfCardNode] });
  await new Promise<void>((resolve) => {
    editor.update(() => {
      build();
    }, { onUpdate: () => resolve() });
  });
  return editor;
}

describe('roundTrip formats', () => {
  it('exports mixed documents in plain, markdown, and html', async () => {
    const editor = await withEditor(() => {
      const root = $getRoot();
      root.clear();
      const heading = $createHeadingNode('h1');
      heading.append($createTextNode('Welcome'));
      const list = $createListNode('bullet');
      const item = $createListItemNode();
      item.append($createTextNode('First item'));
      list.append(item);
      root.append(
        heading,
        list,
        $createIfCardNode({ condition: 'user.age >= 18', content: 'Adult', elseContent: 'Minor', hasElse: true }),
      );
    });

    expect(exportEditorDocument(editor.getEditorState(), 'plain')).toContain('<#if user.age >= 18>');
    expect(exportEditorDocument(editor.getEditorState(), 'markdown')).toContain('# Welcome');
    expect(exportEditorDocument(editor.getEditorState(), 'html')).toContain('<h1>Welcome</h1>');
  });

  it('round-trips textarea input back into the editor for each format', async () => {
    const editor = await withEditor(() => {
      const root = $getRoot();
      root.clear();
      root.append($createParagraphNode());
    });

    await importEditorDocument(editor, 'Plain paragraph\n\n<#if user.active>\n  Yep\n</#if>', 'plain');
    expect(exportEditorDocument(editor.getEditorState(), 'plain')).toContain('<#if user.active>');

    await importEditorDocument(editor, '# Heading\n\n<#if user.vip>\n  VIP\n</#if>', 'markdown');
    expect(exportEditorDocument(editor.getEditorState(), 'markdown')).toContain('# Heading');

    await importEditorDocument(editor, '<h1>Title</h1><p>Body</p>\n<#if user.age > 18>\n  Adult\n</#if>', 'html');
    expect(exportEditorDocument(editor.getEditorState(), 'html')).toContain('<h1>Title</h1>');
  });

  it('keeps node-level error state isolated when one freemarker block fails to import', async () => {
    const editor = await withEditor(() => {
      const root = $getRoot();
      root.clear();
      root.append($createParagraphNode());
    });

    await importEditorDocument(editor, 'Intro\n\n<#if >\nBroken\n</#if>\n\nOutro', 'plain');

    let plain = '';
    let errors = 0;
    editor.getEditorState().read(() => {
      plain = exportEditorDocument(editor.getEditorState(), 'plain');
      errors = $getRoot().getChildren().filter((node) => node instanceof IfCardNode && node.getErrorMessage()).length;
    });

    expect(plain).toContain('Intro');
    expect(plain).toContain('Outro');
    expect(errors).toBe(1);
  });

  it('supports selector switching semantics via format-specific export output', async () => {
    const editor = await withEditor(() => {
      const root = $getRoot();
      root.clear();
      const paragraph = $createParagraphNode();
      const text = $createTextNode('Bold');
      text.toggleFormat('bold');
      paragraph.append(text);
      root.append(paragraph);
    });

    expect(exportEditorDocument(editor.getEditorState(), 'plain')).toBe('Bold');
    expect(exportEditorDocument(editor.getEditorState(), 'markdown')).toBe('**Bold**');
    expect(exportEditorDocument(editor.getEditorState(), 'html')).toBe('<p><strong>Bold</strong></p>');
  });
});

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { $getNodeByKey, type NodeKey } from 'lexical';

import { $isIfCardNode, $updateIfCardNode } from '../nodes/IfCardNode';

export function IfCardComponent({ nodeKey }: { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);

  const [condition, content, elseContent, hasElse, errorMessage] = editor.getEditorState().read(() => {
    const node = $getNodeByKey(nodeKey);
    if (!$isIfCardNode(node)) {
      return ['', '', '', false, null] as const;
    }
    return [node.getCondition(), node.getContent(), node.getElseContent(), node.getHasElse(), node.getErrorMessage()] as const;
  });

  const update = (patch: Partial<{ condition: string; content: string; elseContent: string; hasElse: boolean }>) => {
    editor.update(() => {
      $updateIfCardNode(nodeKey, patch);
    });
  };

  return (
    <div
      className={`if-card ${isSelected ? 'if-card-selected' : ''} ${errorMessage ? 'if-card-error' : ''}`}
      onClick={(event) => {
        event.stopPropagation();
        clearSelection();
        setSelected(true);
      }}
    >
      <div className="if-card-header">
        <label>
          <span>Condition</span>
          <input
            className="if-card-input"
            placeholder="user.age > 18"
            value={condition}
            onChange={(event) => update({ condition: event.target.value })}
          />
        </label>
        <label className="if-card-toggle">
          <input type="checkbox" checked={hasElse} onChange={(event) => update({ hasElse: event.target.checked })} />
          <span>Else branch</span>
        </label>
      </div>
      <div className="if-card-body">
        <label>
          <span>Then</span>
          <textarea className="if-card-textarea" rows={4} value={content} onChange={(event) => update({ content: event.target.value })} />
        </label>
        {hasElse ? (
          <label>
            <span>Else</span>
            <textarea className="if-card-textarea" rows={4} value={elseContent} onChange={(event) => update({ elseContent: event.target.value })} />
          </label>
        ) : null}
      </div>
      {errorMessage ? <p className="if-card-error-text">{errorMessage}</p> : null}
    </div>
  );
}

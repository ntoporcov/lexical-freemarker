import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import type { NodeKey } from 'lexical';

import { $updateIfCardNode } from '../nodes/IfCardNode';

export function IfCardComponent({ nodeKey }: { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);

  const update = (patch: Partial<{ condition: string; content: string; elseContent: string; hasElse: boolean }>) => {
    editor.update(() => {
      $updateIfCardNode(nodeKey, patch);
    });
  };

  return (
    <div
      className={`if-card ${isSelected ? 'if-card-selected' : ''}`}
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
            onChange={(event) => update({ condition: event.target.value })}
          />
        </label>
        <label className="if-card-toggle">
          <input type="checkbox" defaultChecked onChange={(event) => update({ hasElse: event.target.checked })} />
          <span>Else branch</span>
        </label>
      </div>
      <div className="if-card-body">
        <label>
          <span>Then</span>
          <textarea className="if-card-textarea" rows={4} onChange={(event) => update({ content: event.target.value })} />
        </label>
        <label>
          <span>Else</span>
          <textarea className="if-card-textarea" rows={4} onChange={(event) => update({ elseContent: event.target.value })} />
        </label>
      </div>
    </div>
  );
}

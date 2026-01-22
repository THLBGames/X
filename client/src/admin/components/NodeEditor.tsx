import type { FloorNode } from '@idle-rpg/shared';
import './NodeEditor.css';

interface NodeEditorProps {
  node: FloorNode | null;
  onSave: (node: Partial<FloorNode>) => void;
  onCancel: () => void;
}

export default function NodeEditor({ node, onSave, onCancel }: NodeEditorProps) {
  if (!node) return null;

  return (
    <div className="node-editor">
      <h4>Edit Node: {node.name || node.id}</h4>
      <div className="form-group">
        <label>Node Type</label>
        <select value={node.node_type} disabled>
          <option value={node.node_type}>{node.node_type}</option>
        </select>
      </div>
      <div className="form-actions">
        <button onClick={() => onSave({})}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

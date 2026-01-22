import type { FloorNode, FloorConnection } from '@idle-rpg/shared';
import './ConnectionEditor.css';

interface ConnectionEditorProps {
  node: FloorNode;
  connections: FloorConnection[];
  nodes: FloorNode[];
  onDeleteConnection: (connectionId: string) => void;
}

export default function ConnectionEditor({
  node,
  connections,
  nodes,
  onDeleteConnection,
}: ConnectionEditorProps) {
  // Get all connections involving this node
  const nodeConnections = connections.filter(
    (c) => c.from_node_id === node.id || c.to_node_id === node.id
  );

  const getConnectedNode = (conn: FloorConnection): FloorNode | undefined => {
    const otherNodeId = conn.from_node_id === node.id ? conn.to_node_id : conn.from_node_id;
    return nodes.find((n) => n.id === otherNodeId);
  };

  if (nodeConnections.length === 0) {
    return (
      <div className="connection-editor">
        <h5>Connections</h5>
        <p className="no-connections">No connections from this node</p>
      </div>
    );
  }

  return (
    <div className="connection-editor">
      <h5>Connections ({nodeConnections.length})</h5>
      <div className="connections-list">
        {nodeConnections.map((conn) => {
          const connectedNode = getConnectedNode(conn);
          const isFrom = conn.from_node_id === node.id;
          
          return (
            <div key={conn.id} className="connection-item">
              <div className="connection-info">
                <div className="connection-direction">
                  {isFrom ? '→' : '←'} {connectedNode?.name || connectedNode?.node_type || 'Unknown'}
                </div>
                <div className="connection-details">
                  Cost: {conn.movement_cost} {conn.is_bidirectional ? '(bidirectional)' : '(one-way)'}
                </div>
              </div>
              <button
                className="delete-connection-btn"
                onClick={() => {
                  if (confirm('Delete this connection?')) {
                    onDeleteConnection(conn.id);
                  }
                }}
                title="Delete connection"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

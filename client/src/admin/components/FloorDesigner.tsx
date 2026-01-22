import { useState, useEffect } from 'react';
import { AuthService } from '../AuthService';
import type { FloorNode, FloorConnection } from '@idle-rpg/shared';
import FloorCanvas from './FloorCanvas';
import POIPalette from './POIPalette';
import POIInspector from './POIInspector';
import ConnectionEditor from './ConnectionEditor';
import ProceduralGenerator from './ProceduralGenerator';
import ExportImportPanel from './ExportImportPanel';
import { validateFloorLayout } from '../utils/floorValidation';
import './FloorDesigner.css';

interface FloorDesignerProps {
  floorId: string;
  labyrinthId: string;
}

export default function FloorDesigner({ floorId, labyrinthId }: FloorDesignerProps) {
  const [nodes, setNodes] = useState<FloorNode[]>([]);
  const [connections, setConnections] = useState<FloorConnection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPOIType, setSelectedPOIType] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showExportImport, setShowExportImport] = useState(false);
  const [tool, setTool] = useState<'select' | 'place' | 'connect' | 'delete' | 'start_point'>('select');
  const [history, setHistory] = useState<{ nodes: FloorNode[]; connections: FloorConnection[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);

  useEffect(() => {
    loadFloorLayout();
  }, [floorId, labyrinthId]);

  const loadFloorLayout = async () => {
    try {
      setLoading(true);
      const data = await AuthService.apiRequest<{
        success: boolean;
        nodes: FloorNode[];
        connections: FloorConnection[];
      }>(`/api/admin/labyrinths/${labyrinthId}/floors/${floorId}/layout`);
      
      console.log('[FloorDesigner] Loaded layout data:', {
        success: data.success,
        nodesCount: data.nodes?.length || 0,
        connectionsCount: data.connections?.length || 0,
      });
      
      if (data.success) {
        const loadedNodes = Array.isArray(data.nodes) ? data.nodes : [];
        const loadedConnections = Array.isArray(data.connections) ? data.connections : [];
        setNodes(loadedNodes);
        setConnections(loadedConnections);
        console.log('[FloorDesigner] Set nodes:', loadedNodes.length, 'connections:', loadedConnections.length);
      } else {
        console.warn('[FloorDesigner] Load failed or returned success:false');
        setNodes([]);
        setConnections([]);
      }
      setLoading(false);
    } catch (err) {
      console.error('[FloorDesigner] Failed to load floor layout:', err);
      setNodes([]);
      setConnections([]);
      setLoading(false);
    }
  };

  const handleNodeClick = async (node: FloorNode) => {
    if (tool === 'start_point') {
      // Toggle start point status
      try {
        const result = await AuthService.apiRequest<{ success: boolean; node: FloorNode }>(
          `/api/admin/floors/nodes/${node.id}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              is_start_point: !node.is_start_point,
            }),
          }
        );
        if (result.success) {
          saveToHistory();
          setNodes(nodes.map(n => n.id === node.id ? result.node : n));
          setSelectedNodeId(node.id);
        }
      } catch (err) {
        alert('Failed to toggle start point: ' + (err instanceof Error ? err.message : 'Unknown error'));
        console.error('Toggle start point error:', err);
      }
    } else if (tool === 'connect') {
      // Connection mode: first click selects source, second click creates connection
      if (!connectingFrom) {
        setConnectingFrom(node.id);
        setSelectedNodeId(node.id);
      } else if (connectingFrom === node.id) {
        // Clicked same node, cancel connection
        setConnectingFrom(null);
        setSelectedNodeId(null);
      } else {
        // Create connection between connectingFrom and node
        try {
          const result = await AuthService.apiRequest<{ success: boolean; connection: FloorConnection }>(
            `/api/admin/floors/${floorId}/connections`,
            {
              method: 'POST',
              body: JSON.stringify({
                from_node_id: connectingFrom,
                to_node_id: node.id,
                movement_cost: 1,
                is_bidirectional: true,
              }),
            }
          );

          if (result.success) {
            saveToHistory();
            setConnections([...connections, result.connection]);
            setConnectingFrom(null);
            setSelectedNodeId(node.id);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to create connection';
          alert(`Failed to create connection: ${errorMessage}`);
          console.error('Create connection error:', err);
          setConnectingFrom(null);
        }
      }
    } else {
      setSelectedNodeId(node.id);
    }
  };

  const handleCanvasClick = async (point: { x: number; y: number }) => {
    if (tool === 'place' && selectedPOIType) {
      // Place new POI at clicked location
      try {
        const newNode = await AuthService.apiRequest<{ success: boolean; node: FloorNode }>(
          `/api/admin/floors/${floorId}/nodes`,
          {
            method: 'POST',
            body: JSON.stringify({
              floor_id: floorId,
              node_type: selectedPOIType,
              x_coordinate: point.x,
              y_coordinate: point.y,
              name: `New ${selectedPOIType}`,
            }),
          }
        );

        if (newNode.success) {
          saveToHistory();
          setNodes([...nodes, newNode.node]);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create node';
        alert(`Failed to create node: ${errorMessage}`);
        console.error('Create node error:', err);
      }
    } else if (tool === 'delete' && selectedNodeId) {
      // Delete selected node
      try {
        await AuthService.apiRequest(`/api/admin/floors/nodes/${selectedNodeId}`, {
          method: 'DELETE',
        });
        saveToHistory();
        setNodes(nodes.filter(n => n.id !== selectedNodeId));
        setConnections(connections.filter(c => 
          c.from_node_id !== selectedNodeId && c.to_node_id !== selectedNodeId
        ));
        setSelectedNodeId(null);
      } catch (err) {
        alert('Failed to delete node');
      }
    }
  };

  const saveToHistory = () => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: [...nodes], connections: [...connections] });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setNodes(prevState.nodes);
      setConnections(prevState.connections);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setConnections(nextState.connections);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const handleSave = async () => {
    // Validate layout before saving
    const validation = validateFloorLayout(nodes, connections);
    if (!validation.valid) {
      alert(`Cannot save layout:\n${validation.errors.join('\n')}`);
      return;
    }

    if (validation.warnings.length > 0) {
      const proceed = confirm(
        `Layout has warnings:\n${validation.warnings.join('\n')}\n\nDo you want to save anyway?`
      );
      if (!proceed) return;
    }

    try {
      const result = await AuthService.apiRequest<{
        success: boolean;
        nodes: FloorNode[];
        connections: FloorConnection[];
      }>(`/api/admin/labyrinths/${labyrinthId}/floors/${floorId}/layout`, {
        method: 'POST',
        body: JSON.stringify({ nodes, connections }),
      });
      
      if (result.success) {
        // Update local state with the saved nodes and connections (which may have updated IDs)
        setNodes(result.nodes || nodes);
        setConnections(result.connections || connections);
        alert('Layout saved successfully!');
      } else {
        alert('Failed to save layout');
      }
    } catch (err) {
      alert('Failed to save layout: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (loading) {
    return <div>Loading floor layout...</div>;
  }

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  return (
    <div className="floor-designer">
      <div className="floor-designer-toolbar">
        <h3>Floor Designer</h3>
        <div className="toolbar-tools">
          <button
            className={tool === 'select' ? 'active' : ''}
            onClick={() => setTool('select')}
            title="Select tool"
          >
            ✓
          </button>
          <button
            className={tool === 'place' ? 'active' : ''}
            onClick={() => setTool('place')}
            title="Place POI"
            disabled={!selectedPOIType}
          >
            +
          </button>
          <button
            className={tool === 'connect' ? 'active' : ''}
            onClick={() => {
              setTool('connect');
              setConnectingFrom(null);
              setSelectedNodeId(null);
            }}
            title="Connect nodes (click source, then destination)"
          >
            ⟷
          </button>
          <button
            className={tool === 'start_point' ? 'active' : ''}
            onClick={() => {
              setTool('start_point');
              setConnectingFrom(null);
            }}
            title="Toggle start point (click nodes to mark/unmark as start point)"
          >
            ⭐
          </button>
          <button
            className={tool === 'delete' ? 'active' : ''}
            onClick={() => setTool('delete')}
            title="Delete selected"
          >
            ✕
          </button>
          <div className="toolbar-separator" />
          <button onClick={undo} disabled={historyIndex <= 0} title="Undo">
            ↶
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo">
            ↷
          </button>
        </div>
        <div className="toolbar-actions">
          <button onClick={handleSave}>Save Layout</button>
          <button onClick={() => setShowGenerator(!showGenerator)}>
            {showGenerator ? 'Hide' : 'Show'} Generator
          </button>
          <button onClick={() => setShowExportImport(!showExportImport)}>
            {showExportImport ? 'Hide' : 'Show'} Export/Import
          </button>
        </div>
      </div>

      <div className="floor-designer-content">
        <div className="floor-designer-sidebar">
          <POIPalette
            selectedType={selectedPOIType}
            onSelectType={setSelectedPOIType}
          />
          <div className="start-points-panel">
            <h4>Start Points ({nodes.filter(n => n.is_start_point).length})</h4>
            <div className="start-points-list">
              {nodes.filter(n => n.is_start_point).length === 0 ? (
                <div className="no-start-points">No start points marked</div>
              ) : (
                nodes
                  .filter(n => n.is_start_point)
                  .map(node => (
                    <div
                      key={node.id}
                      className={`start-point-item ${selectedNodeId === node.id ? 'selected' : ''}`}
                      onClick={() => setSelectedNodeId(node.id)}
                    >
                      <span className="start-point-icon">⭐</span>
                      <span className="start-point-name">{node.name || `Node ${node.id.slice(0, 8)}`}</span>
                      <span className="start-point-type">{node.node_type}</span>
                    </div>
                  ))
              )}
            </div>
            {tool === 'start_point' && (
              <div className="tool-hint">
                Click nodes on the canvas to toggle them as start points
              </div>
            )}
          </div>
        </div>

        <div className="floor-designer-main">
          <FloorCanvas
            nodes={nodes}
            connections={connections}
            selectedNodeId={selectedNodeId}
            connectingFrom={tool === 'connect' ? connectingFrom : null}
            currentTool={tool}
            onNodeClick={handleNodeClick}
            onCanvasClick={handleCanvasClick}
          />
        </div>

        <div className="floor-designer-inspector">
          {selectedNode ? (
            <div>
              <POIInspector
                node={selectedNode}
                onSave={async (updates) => {
                  try {
                    const result = await AuthService.apiRequest<{ success: boolean; node: FloorNode }>(
                      `/api/admin/floors/nodes/${selectedNode.id}`,
                      {
                        method: 'PUT',
                        body: JSON.stringify(updates),
                      }
                    );
                    if (result.success) {
                      saveToHistory();
                      setNodes(nodes.map(n => n.id === selectedNode.id ? result.node : n));
                    }
                  } catch (err) {
                    alert('Failed to update node: ' + (err instanceof Error ? err.message : 'Unknown error'));
                    console.error('Update node error:', err);
                  }
                }}
                onCancel={() => setSelectedNodeId(null)}
              />
              <ConnectionEditor
                node={selectedNode}
                connections={connections}
                nodes={nodes}
                onDeleteConnection={async (connectionId) => {
                  try {
                    await AuthService.apiRequest(`/api/admin/floors/connections/${connectionId}`, {
                      method: 'DELETE',
                    });
                    saveToHistory();
                    setConnections(connections.filter(c => c.id !== connectionId));
                  } catch (err) {
                    alert('Failed to delete connection');
                  }
                }}
              />
            </div>
          ) : (
            <div className="no-selection">Select a POI to edit</div>
          )}
        </div>
      </div>

      {showGenerator && (
        <ProceduralGenerator
          floorId={floorId}
          labyrinthId={labyrinthId}
          onGenerate={(generatedNodes, generatedConnections) => {
            setNodes(generatedNodes);
            setConnections(generatedConnections);
          }}
          onClose={() => setShowGenerator(false)}
        />
      )}

      {showExportImport && (
        <ExportImportPanel
          floorId={floorId}
          labyrinthId={labyrinthId}
          onClose={() => setShowExportImport(false)}
        />
      )}
    </div>
  );
}

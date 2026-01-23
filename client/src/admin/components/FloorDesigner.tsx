import { useState, useEffect, useCallback } from 'react';
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

  const loadFloorLayout = useCallback(async () => {
    if (!floorId || !labyrinthId) {
      console.warn('[FloorDesigner] Cannot load layout - missing floorId or labyrinthId', { floorId, labyrinthId });
      return;
    }
    
    try {
      setLoading(true);
      console.log('[FloorDesigner] Loading layout for floor:', floorId, 'labyrinth:', labyrinthId);
      const data = await AuthService.apiRequest<{
        success: boolean;
        nodes: FloorNode[];
        connections: FloorConnection[];
      }>(`/api/admin/labyrinths/${labyrinthId}/floors/${floorId}/layout`);
      
      console.log('[FloorDesigner] Loaded layout data:', {
        success: data.success,
        nodesCount: data.nodes?.length || 0,
        connectionsCount: data.connections?.length || 0,
        floorId,
        labyrinthId,
      });
      
      if (data.success) {
        const loadedNodes = Array.isArray(data.nodes) ? data.nodes : [];
        const loadedConnections = Array.isArray(data.connections) ? data.connections : [];
        
        // Ensure all loaded nodes have metadata as objects (not null/undefined)
        const normalizedNodes = loadedNodes.map(node => ({
          ...node,
          metadata: node.metadata && typeof node.metadata === 'object' ? node.metadata : {},
        }));
        
        const nodesWithPOICombat = normalizedNodes.filter(n => n.metadata?.poi_combat?.enabled);
        console.log('[FloorDesigner] Loaded nodes:', normalizedNodes.length, 'connections:', loadedConnections.length);
        console.log('[FloorDesigner] Nodes with POI combat:', nodesWithPOICombat.length);
        if (nodesWithPOICombat.length > 0) {
          console.log('[FloorDesigner] Sample POI combat node:', {
            id: nodesWithPOICombat[0].id,
            metadataKeys: Object.keys(nodesWithPOICombat[0].metadata || {}),
            poiCombat: nodesWithPOICombat[0].metadata?.poi_combat,
          });
        }
        
        setNodes(normalizedNodes);
        setConnections(loadedConnections);
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
  }, [floorId, labyrinthId]);

  useEffect(() => {
    console.log('[FloorDesigner] useEffect triggered', { floorId, labyrinthId });
    if (floorId && labyrinthId) {
      console.log('[FloorDesigner] Calling loadFloorLayout');
      loadFloorLayout();
    } else {
      console.warn('[FloorDesigner] Missing floorId or labyrinthId, not loading layout');
      setNodes([]);
      setConnections([]);
      setLoading(false);
    }
  }, [floorId, labyrinthId, loadFloorLayout]);

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

    // Ensure all nodes have complete data including metadata
    // CRITICAL: Always include metadata in the save payload, even if it appears empty in client state
    // The server will merge with existing database metadata to preserve POI combat configs
    const nodesToSave = nodes.map(node => {
      const nodeCopy: any = {
        ...node,
      };
      
      // Always include metadata field - ensure it's an object
      // Even if it's empty in client state, include it so server can merge with existing
      nodeCopy.metadata = node.metadata && typeof node.metadata === 'object' 
        ? node.metadata 
        : {};
      
      return nodeCopy;
    });

    // Log metadata info for debugging
    const nodesWithMetadata = nodesToSave.filter(n => n.metadata && Object.keys(n.metadata).length > 0);
    const nodesWithPOICombat = nodesToSave.filter(n => n.metadata?.poi_combat?.enabled);
    console.log('[FloorDesigner] Saving layout:', {
      totalNodes: nodesToSave.length,
      nodesWithMetadata: nodesWithMetadata.length,
      nodesWithPOICombat: nodesWithPOICombat.length,
      nodesInStateWithMetadata: nodes.filter(n => n.metadata && Object.keys(n.metadata).length > 0).length,
    });
    
    // Log a sample node to see what we're sending
    if (nodesToSave.length > 0) {
      const sample = nodesToSave[0];
      console.log('[FloorDesigner] Sample node being saved:', {
        id: sample.id,
        hasMetadata: !!sample.metadata,
        metadataKeys: sample.metadata ? Object.keys(sample.metadata).length : 0,
        nodeType: sample.node_type,
      });
    }

    try {
      const result = await AuthService.apiRequest<{
        success: boolean;
        nodes: FloorNode[];
        connections: FloorConnection[];
      }>(`/api/admin/labyrinths/${labyrinthId}/floors/${floorId}/layout`, {
        method: 'POST',
        body: JSON.stringify({ nodes: nodesToSave, connections }),
      });
      
      if (result.success) {
        // Update local state with the saved nodes and connections (which may have updated IDs)
        // Normalize nodes to ensure metadata is preserved
        const savedNodes = (result.nodes || nodesToSave).map(node => ({
          ...node,
          metadata: node.metadata && typeof node.metadata === 'object' ? node.metadata : {},
        }));
        
        const savedNodesWithPOICombat = savedNodes.filter(n => n.metadata?.poi_combat?.enabled);
        console.log('[FloorDesigner] After save, nodes with POI combat:', savedNodesWithPOICombat.length);
        
        setNodes(savedNodes);
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
                    // Ensure metadata is properly included in updates
                    const updatesWithMetadata = {
                      ...updates,
                      metadata: updates.metadata || selectedNode.metadata || {},
                    };
                    
                    const result = await AuthService.apiRequest<{ success: boolean; node: FloorNode }>(
                      `/api/admin/floors/nodes/${selectedNode.id}`,
                      {
                        method: 'PUT',
                        body: JSON.stringify(updatesWithMetadata),
                      }
                    );
                    if (result.success) {
                      saveToHistory();
                      // Update the node in local state, preserving all fields including metadata
                      setNodes(nodes.map(n => {
                        if (n.id === selectedNode.id) {
                          return {
                            ...result.node,
                            // Ensure metadata is preserved
                            metadata: result.node.metadata || {},
                          };
                        }
                        return n;
                      }));
                      // Update selected node reference if it changed
                      if (result.node.id === selectedNode.id) {
                        setSelectedNodeId(result.node.id);
                      }
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
          onGenerate={async (generatedNodes, generatedConnections) => {
            // Normalize nodes to ensure metadata is preserved
            const normalizedNodes = generatedNodes.map(node => ({
              ...node,
              metadata: node.metadata && typeof node.metadata === 'object' ? node.metadata : {},
            }));
            
            const nodesWithPOICombat = normalizedNodes.filter(n => n.metadata?.poi_combat?.enabled);
            console.log('[FloorDesigner] Generated nodes:', {
              total: normalizedNodes.length,
              withPOICombat: nodesWithPOICombat.length,
            });
            if (nodesWithPOICombat.length > 0) {
              console.log('[FloorDesigner] Sample POI combat node:', {
                id: nodesWithPOICombat[0].id,
                metadataKeys: Object.keys(nodesWithPOICombat[0].metadata || {}),
              });
            }
            
            setNodes(normalizedNodes);
            setConnections(generatedConnections);
            // Reload from server to ensure we have all metadata including monster pools
            await loadFloorLayout();
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

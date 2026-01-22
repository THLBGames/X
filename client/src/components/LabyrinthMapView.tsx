import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameState } from '../systems';
import { LabyrinthClient } from '../systems/labyrinth/LabyrinthClient';
import { useLabyrinthState } from '../systems/labyrinth/LabyrinthState';
import type { FloorNode, FloorConnection, ParticipantPosition } from '@idle-rpg/shared';
import './LabyrinthMapView.css';

interface LabyrinthMapViewProps {
  labyrinthId: string;
  characterId: string;
  labyrinthClient: LabyrinthClient;
}

interface MapData {
  nodes: FloorNode[];
  connections: FloorConnection[];
  metadata: {
    bounds: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    };
    startPoints: string[];
    bossRooms: string[];
    stairNodes: string[];
    specialNodes: Record<string, string[]>;
  };
}

interface VisibilityData {
  visibleNodes: string[];
  exploredNodes: string[];
  adjacentNodes: string[];
  visibilityByNode: Record<string, 'explored' | 'adjacent' | 'hidden' | 'revealed'>;
}

export default function LabyrinthMapView({ labyrinthId, characterId, labyrinthClient }: LabyrinthMapViewProps) {
  const { t } = useTranslation('ui');
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [visibility, setVisibility] = useState<VisibilityData | null>(null);
  const [position, setPosition] = useState<ParticipantPosition | null>(null);
  const [nodesWithPlayers, setNodesWithPlayers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [movementPoints, setMovementPoints] = useState<number>(0);
  const [currentNodeHasWaveCombat, setCurrentNodeHasWaveCombat] = useState<boolean>(false);
  const [waveCombatInfo, setWaveCombatInfo] = useState<{ totalWaves: number } | null>(null);
  const currentParticipant = useLabyrinthState((state) => state.currentParticipant);
  const character = useGameState((state) => state.character);

  useEffect(() => {
    loadMapData();

    // Set up socket listeners
    const originalOnMapData = labyrinthClient.callbacks.onMapData;
    const originalOnMapUpdate = labyrinthClient.callbacks.onMapUpdate;
    const originalOnVisibilityUpdate = labyrinthClient.callbacks.onVisibilityUpdate;

    labyrinthClient.callbacks.onMapData = (data: any) => {
      if (data.map) {
        setMapData(data.map);
      }
      if (data.visibility) {
        setVisibility(data.visibility);
      }
      if (data.nodesWithPlayers) {
        setNodesWithPlayers(data.nodesWithPlayers);
      }
      originalOnMapData?.(data);
    };

    labyrinthClient.callbacks.onMapUpdate = (data: any) => {
      if (data.map) {
        setMapData((prev) => ({ ...prev!, ...data.map }));
      }
      if (data.visibility) {
        setVisibility((prev) => ({ ...prev!, ...data.visibility }));
      }
      if (data.nodesWithPlayers) {
        setNodesWithPlayers((prev) => ({ ...prev, ...data.nodesWithPlayers }));
      }
      originalOnMapUpdate?.(data);
    };

    labyrinthClient.callbacks.onVisibilityUpdate = (data: any) => {
      if (data.visibility) {
        setVisibility(data.visibility);
      }
      originalOnVisibilityUpdate?.(data);
    };

    // Request map data via socket
    if (labyrinthClient.isConnected()) {
      labyrinthClient.requestMapData(labyrinthId, characterId);
    }

    return () => {
      labyrinthClient.callbacks.onMapData = originalOnMapData;
      labyrinthClient.callbacks.onMapUpdate = originalOnMapUpdate;
      labyrinthClient.callbacks.onVisibilityUpdate = originalOnVisibilityUpdate;
    };
  }, [labyrinthId, characterId, labyrinthClient]);

  const loadMapData = async () => {
    try {
      const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
      const [mapResponse, positionResponse] = await Promise.all([
        fetch(`${SERVER_URL}/api/labyrinth/${labyrinthId}/map?character_id=${characterId}`),
        fetch(`${SERVER_URL}/api/labyrinth/${labyrinthId}/position?character_id=${characterId}`),
      ]);

      const mapResult = await mapResponse.json();
      const positionResult = await positionResponse.json();

      if (mapResult.success) {
        setMapData(mapResult.map);
        setVisibility(mapResult.visibility);
        setNodesWithPlayers(mapResult.nodesWithPlayers || {});
      }

      if (positionResult.success) {
        setPosition(positionResult.position);
        setMovementPoints(positionResult.movementPoints || 0);
        
        // Check if current node has wave combat enabled
        if (positionResult.position?.current_node_id && mapResult.success && mapResult.map) {
          const currentNode = mapResult.map.nodes.find(
            (n: FloorNode) => n.id === positionResult.position.current_node_id
          );
          if (currentNode?.metadata?.poi_combat?.enabled) {
            setCurrentNodeHasWaveCombat(true);
            setWaveCombatInfo({
              totalWaves: currentNode.metadata.poi_combat.waves?.length || 0,
            });
          } else {
            setCurrentNodeHasWaveCombat(false);
            setWaveCombatInfo(null);
          }
        } else {
          setCurrentNodeHasWaveCombat(false);
          setWaveCombatInfo(null);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to load map:', err);
      setLoading(false);
    }
  };

  const handleNodeClick = (nodeId: string) => {
    if (selectedNode === nodeId) {
      setSelectedNode(null);
    } else {
      setSelectedNode(nodeId);
    }
  };

  const handleConfirmMove = async () => {
    if (!selectedNode || !currentParticipant) return;

    try {
      const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
      const result = await fetch(`${SERVER_URL}/api/labyrinth/${labyrinthId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character_id: characterId, target_node_id: selectedNode }),
      });

      const data = await result.json();
      if (data.success) {
        setPosition(data.newPosition);
        setMovementPoints(data.movementPointsRemaining || 0);
        setSelectedNode(null);
        // Reload map to get updated visibility
        loadMapData();
      } else {
        alert(data.message || 'Cannot move to that node');
      }
    } catch (err) {
      console.error('Failed to move:', err);
      alert('Failed to move');
    }
  };

  const handleCancelMove = () => {
    setSelectedNode(null);
  };

  const handleStartPOICombat = async () => {
    if (!currentParticipant || !position?.current_node_id || !character) return;

    try {
      // Use socket to start POI combat (more efficient than REST)
      labyrinthClient.startPOICombat(
        currentParticipant.id,
        position.current_node_id,
        character
      );
    } catch (err) {
      console.error('Failed to start POI combat:', err);
      alert('Failed to start combat');
    }
  };

  const getNodeVisibility = (nodeId: string): 'explored' | 'adjacent' | 'hidden' | 'revealed' => {
    if (!visibility) return 'explored'; // Fallback: treat as explored if visibility not loaded
    return visibility.visibilityByNode[nodeId] || 'hidden';
  };

  const isNodeVisible = (nodeId: string): boolean => {
    if (!visibility) return true; // Fallback: show all if visibility not loaded
    return visibility.visibleNodes.includes(nodeId);
  };

  const canMoveToNode = (nodeId: string): boolean => {
    if (!position || !visibility) return false;
    if (position.current_node_id === nodeId) return false;
    // Can move to adjacent nodes or explored nodes
    return visibility.adjacentNodes.includes(nodeId) || visibility.exploredNodes.includes(nodeId);
  };

  if (loading) {
    return <div className="labyrinth-map-view loading">{t('labyrinth.loadingMap', { defaultValue: 'Loading map...' })}</div>;
  }

  if (!mapData || !visibility) {
    return <div className="labyrinth-map-view error">{t('labyrinth.mapNotFound', { defaultValue: 'Map data not available' })}</div>;
  }

  // Calculate bounds for rendering
  const padding = 50;
  let boundsWidth = mapData.metadata.bounds.maxX - mapData.metadata.bounds.minX;
  let boundsHeight = mapData.metadata.bounds.maxY - mapData.metadata.bounds.minY;
  
  // If bounds are invalid or zero (e.g., no nodes or all at same position), use defaults
  if (boundsWidth <= 0 || boundsHeight <= 0 || !isFinite(boundsWidth) || !isFinite(boundsHeight)) {
    boundsWidth = 700;
    boundsHeight = 500;
  }
  
  // Ensure minimum size
  const width = Math.max(boundsWidth + padding * 2, 800);
  const height = Math.max(boundsHeight + padding * 2, 600);

  console.log('Map data:', {
    nodeCount: mapData.nodes.length,
    connectionCount: mapData.connections.length,
    bounds: mapData.metadata.bounds,
    width,
    height,
    visibleNodes: visibility?.visibleNodes?.length || 0,
    exploredNodes: visibility?.exploredNodes?.length || 0,
    currentPosition: position?.current_node_id,
    nodes: mapData.nodes.map(n => ({ id: n.id, x: n.x_coordinate, y: n.y_coordinate, type: n.node_type, isStart: n.is_start_point })),
  });

  return (
    <div className="labyrinth-map-view">
      <div className="map-header">
        <div className="map-info">
          <span>{t('labyrinth.movementPoints', { defaultValue: 'Movement Points' })}: {movementPoints.toFixed(1)}</span>
        </div>
      </div>
      <div className="map-canvas" style={{ width: `${width}px`, minWidth: '800px', height: `${height}px`, minHeight: '600px', position: 'relative' }}>
        {/* Render connections */}
        {mapData.connections.map((connection) => {
          const fromNode = mapData.nodes.find((n) => n.id === connection.from_node_id);
          const toNode = mapData.nodes.find((n) => n.id === connection.to_node_id);
          
          if (!fromNode || !toNode) return null;
          
          const fromVisible = isNodeVisible(fromNode.id);
          const toVisible = isNodeVisible(toNode.id);
          
          if (!fromVisible && !toVisible) return null;
          
          const isVisible = fromVisible && toVisible;
          const isExplored = visibility.exploredNodes.includes(fromNode.id) && visibility.exploredNodes.includes(toNode.id);

          return (
            <svg
              key={connection.id}
              className={`map-connection ${isVisible ? 'visible' : 'fog'} ${isExplored ? 'explored' : ''}`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            >
              <line
                x1={fromNode.x_coordinate - mapData.metadata.bounds.minX + padding}
                y1={fromNode.y_coordinate - mapData.metadata.bounds.minY + padding}
                x2={toNode.x_coordinate - mapData.metadata.bounds.minX + padding}
                y2={toNode.y_coordinate - mapData.metadata.bounds.minY + padding}
                stroke={isVisible ? (isExplored ? '#888' : '#aaa') : '#333'}
                strokeWidth={isVisible ? 2 : 1}
                opacity={isVisible ? (isExplored ? 0.8 : 0.5) : 0.3}
              />
            </svg>
          );
        })}

        {/* Render nodes - always show current node and start points */}
        {mapData.nodes.map((node) => {
          const nodeVisibility = getNodeVisibility(node.id);
          const isVisible = isNodeVisible(node.id);
          const isCurrent = position?.current_node_id === node.id;
          const isSelected = selectedNode === node.id;
          const isStartPoint = mapData.metadata.startPoints.includes(node.id);
          const playerCount = nodesWithPlayers[node.id] || 0;
          const canMove = canMoveToNode(node.id);

          // Always render: current node, start points, visible/adjacent nodes
          // For fog of war: show explored nodes fully, adjacent nodes dimmed, hidden nodes not shown
          const shouldRender = isCurrent || isStartPoint || isVisible || nodeVisibility === 'adjacent';
          if (!shouldRender && nodeVisibility === 'hidden') {
            return null; // Don't render hidden nodes
          }

          return (
            <div
              key={node.id}
              className={`map-node node-${node.node_type} 
                ${isCurrent ? 'current' : ''} 
                ${isSelected ? 'selected' : ''}
                ${canMove ? 'can-move' : ''}
                visibility-${nodeVisibility}`}
              onClick={() => canMove && handleNodeClick(node.id)}
              style={{
                left: `${(node.x_coordinate - mapData.metadata.bounds.minX + padding)}px`,
                top: `${(node.y_coordinate - mapData.metadata.bounds.minY + padding)}px`,
                backgroundColor: node.node_type === 'boss' ? '#e74c3c' :
                                node.node_type === 'stairs' ? '#2ecc71' :
                                node.node_type === 'safe_zone' ? '#3498db' :
                                node.node_type === 'crafting' ? '#f39c12' :
                                node.node_type === 'monster_spawn' ? '#95a5a6' :
                                node.node_type === 'monster_spawner' ? '#8e44ad' :
                                isStartPoint ? '#27ae60' : '#555',
              }}
              title={node.name || node.node_type}
            >
              <div className="node-icon">{getNodeIcon(node.node_type)}</div>
              {playerCount > 0 && <div className="node-players">{playerCount}</div>}
            </div>
          );
        })}

        {/* Inline confirmation UI */}
        {selectedNode && (
          <div
            className="movement-confirmation"
            style={{
              left: `${mapData.nodes.find((n) => n.id === selectedNode)!.x_coordinate - mapData.metadata.bounds.minX + padding}px`,
              top: `${mapData.nodes.find((n) => n.id === selectedNode)!.y_coordinate - mapData.metadata.bounds.minY + padding - 60}px`,
            }}
          >
            <div className="confirmation-content">
              <div className="confirmation-info">
                {mapData.nodes.find((n) => n.id === selectedNode)?.name || selectedNode}
              </div>
              <div className="confirmation-buttons">
                <button onClick={handleConfirmMove} className="confirm-button">
                  {t('labyrinth.confirmMove', { defaultValue: 'Confirm' })}
                </button>
                <button onClick={handleCancelMove} className="cancel-button">
                  {t('labyrinth.cancelMove', { defaultValue: 'Cancel' })}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* POI Combat Start Button */}
        {currentNodeHasWaveCombat && position?.current_node_id && (
          <div
            className="poi-combat-panel"
            style={{
              left: `${mapData.nodes.find((n) => n.id === position.current_node_id)!.x_coordinate - mapData.metadata.bounds.minX + padding}px`,
              top: `${mapData.nodes.find((n) => n.id === position.current_node_id)!.y_coordinate - mapData.metadata.bounds.minY + padding + 50}px`,
            }}
          >
            <div className="poi-combat-content">
              <div className="poi-combat-info">
                <div className="poi-combat-title">
                  {t('labyrinth.poiCombat', { defaultValue: 'Wave Combat Available' })}
                </div>
                {waveCombatInfo && (
                  <div className="poi-combat-waves">
                    {t('labyrinth.totalWaves', { defaultValue: 'Total Waves' })}: {waveCombatInfo.totalWaves}
                  </div>
                )}
              </div>
              <button onClick={handleStartPOICombat} className="btn-start-poi-combat">
                {t('labyrinth.startCombat', { defaultValue: 'Start Combat' })}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getNodeIcon(nodeType: string): string {
  switch (nodeType) {
    case 'boss':
      return '👹';
    case 'monster_spawn':
      return '⚔️';
    case 'monster_spawner':
      return '🐉';
    case 'safe_zone':
      return '🛡️';
    case 'crafting':
      return '⚒️';
    case 'stairs':
      return '📶';
    case 'guild_hall':
      return '🏛️';
    default:
      return '📍';
  }
}
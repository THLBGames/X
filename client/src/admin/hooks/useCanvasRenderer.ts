import { useEffect, useRef, useState, useCallback } from 'react';
import type { FloorNode, FloorConnection } from '@idle-rpg/shared';
import { applyInverseTransform, type Transform, type Point } from '../utils/canvasUtils';

interface UseCanvasRendererOptions {
  nodes: FloorNode[];
  connections: FloorConnection[];
  width: number;
  height: number;
  onNodeClick?: (node: FloorNode) => void;
  onCanvasClick?: (point: Point) => void;
  selectedNodeId?: string | null;
  connectingFrom?: string | null;
  currentTool?: 'select' | 'place' | 'connect' | 'delete' | 'start_point';
  gridSize?: number;
  showGrid?: boolean;
}

export function useCanvasRenderer({
  nodes,
  connections,
  width,
  height,
  onNodeClick,
  onCanvasClick,
  selectedNodeId,
  connectingFrom,
  currentTool = 'select',
  gridSize = 50,
  showGrid = true,
}: UseCanvasRendererOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [clickStart, setClickStart] = useState<Point | null>(null);
  const [hasMoved, setHasMoved] = useState(false);

  // Node type colors
  const nodeColors: Record<string, string> = {
    regular: '#666',
    monster_spawn: '#95a5a6',
    monster_spawner: '#e74c3c',
    boss: '#8e44ad',
    safe_zone: '#3498db',
    crafting: '#f39c12',
    stairs: '#2ecc71',
    guild_hall: '#9b59b6',
  };

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const point: Point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    // Check if clicking on a node
    const worldPoint = applyInverseTransform(point, transform);
    const clickedNode = nodes.find(node => {
      const dist = Math.sqrt(
        Math.pow(node.x_coordinate - worldPoint.x, 2) + Math.pow(node.y_coordinate - worldPoint.y, 2)
      );
      return dist < 20 / transform.scale; // Scale-aware hit radius
    });

    if (clickedNode) {
      onNodeClick?.(clickedNode);
    } else {
      // Track click start position to distinguish clicks from drags
      setClickStart({ x: e.clientX, y: e.clientY });
      setHasMoved(false);
      
      // Only allow canvas dragging if not in place or start_point mode
      if (currentTool !== 'start_point' && currentTool !== 'place') {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    }
  }, [nodes, transform, onNodeClick, onCanvasClick, currentTool]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging && dragStart) {
      // Check if mouse has moved significantly (more than 5 pixels = drag, not click)
      if (clickStart) {
        const moveDistance = Math.sqrt(
          Math.pow(e.clientX - clickStart.x, 2) + Math.pow(e.clientY - clickStart.y, 2)
        );
        if (moveDistance > 5) {
          setHasMoved(true);
        }
      }
      
      const dx = (e.clientX - dragStart.x) / transform.scale;
      const dy = (e.clientY - dragStart.y) / transform.scale;
      setTransform(prev => ({
        ...prev,
        x: prev.x - dx,
        y: prev.y - dy,
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [isDragging, dragStart, clickStart, transform.scale]);

  const handleMouseUp = useCallback((e?: React.MouseEvent<HTMLCanvasElement>) => {
    // If this was a click (not a drag), trigger onCanvasClick
    // This applies to 'place' mode or when we had a click without dragging
    if (!hasMoved && clickStart && e && (currentTool === 'place' || (!isDragging && currentTool !== 'start_point'))) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const point: Point = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        const worldPoint = applyInverseTransform(point, transform);
        onCanvasClick?.(worldPoint);
      }
    }
    
    setIsDragging(false);
    setDragStart(null);
    setClickStart(null);
    setHasMoved(false);
  }, [isDragging, hasMoved, clickStart, transform, onCanvasClick, currentTool, canvasRef]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, transform.scale * delta));

    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const point: Point = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      const worldPoint = applyInverseTransform(point, transform);
      
      setTransform({
        x: worldPoint.x - point.x / newScale,
        y: worldPoint.y - point.y / newScale,
        scale: newScale,
      });
    }
  }, [transform]);

  // Attach wheel event listener directly to canvas with passive: false
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Save context
    ctx.save();

    // Apply transform
    ctx.translate(-transform.x * transform.scale, -transform.y * transform.scale);
    ctx.scale(transform.scale, transform.scale);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1 / transform.scale;
      const startX = Math.floor(transform.x / gridSize) * gridSize;
      const startY = Math.floor(transform.y / gridSize) * gridSize;
      const endX = startX + width / transform.scale + gridSize;
      const endY = startY + height / transform.scale + gridSize;

      for (let x = startX; x <= endX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
      }

      for (let y = startY; y <= endY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
      }
    }

    // Draw connections
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2 / transform.scale;
    for (const conn of connections) {
      const fromNode = nodes.find(n => n.id === conn.from_node_id);
      const toNode = nodes.find(n => n.id === conn.to_node_id);
      
      if (fromNode && toNode) {
        ctx.beginPath();
        ctx.moveTo(fromNode.x_coordinate, fromNode.y_coordinate);
        ctx.lineTo(toNode.x_coordinate, toNode.y_coordinate);
        ctx.stroke();
      }
    }

    // Draw nodes
    const connectingFromNode = connectingFrom ? nodes.find(n => n.id === connectingFrom) : null;
    
    for (const node of nodes) {
      const color = nodeColors[node.node_type] || '#666';
      const isSelected = node.id === selectedNodeId;
      const isConnectingFrom = node.id === connectingFrom;
      const isStartPoint = node.is_start_point;
      const isStartPointTool = currentTool === 'start_point';
      const radius = isSelected || isConnectingFrom ? 15 : 12;

      // Draw node
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x_coordinate, node.y_coordinate, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw start point indicator (outer ring)
      if (isStartPoint) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 4 / transform.scale;
        ctx.beginPath();
        ctx.arc(node.x_coordinate, node.y_coordinate, radius + 4 / transform.scale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Highlight nodes when in start_point tool mode
      if (isStartPointTool && !isStartPoint) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2 / transform.scale;
        ctx.setLineDash([3 / transform.scale, 3 / transform.scale]);
        ctx.beginPath();
        ctx.arc(node.x_coordinate, node.y_coordinate, radius + 2 / transform.scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3 / transform.scale;
        ctx.stroke();
      }

      if (isConnectingFrom) {
        ctx.strokeStyle = '#6c5ce7';
        ctx.lineWidth = 3 / transform.scale;
        ctx.setLineDash([5 / transform.scale, 5 / transform.scale]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw temporary connection line if connecting
      if (connectingFromNode && node.id !== connectingFrom) {
        ctx.strokeStyle = '#6c5ce7';
        ctx.lineWidth = 2 / transform.scale;
        ctx.setLineDash([5 / transform.scale, 5 / transform.scale]);
        ctx.beginPath();
        ctx.moveTo(connectingFromNode.x_coordinate, connectingFromNode.y_coordinate);
        ctx.lineTo(node.x_coordinate, node.y_coordinate);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw label if zoomed in enough
      if (transform.scale > 0.5) {
        ctx.fillStyle = '#fff';
        ctx.font = `${12 / transform.scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let label = node.name || node.node_type;
        if (isStartPoint) {
          label = '⭐ ' + label;
        }
        ctx.fillText(label, node.x_coordinate, node.y_coordinate - 20 / transform.scale);
      }
    }

    ctx.restore();
  }, [nodes, connections, transform, width, height, selectedNodeId, connectingFrom, currentTool, showGrid, gridSize]);

  useEffect(() => {
    render();
  }, [render]);

  return {
    canvasRef,
    transform,
    setTransform,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp: (e?: React.MouseEvent<HTMLCanvasElement>) => handleMouseUp(e),
    render,
  };
}

import { useEffect } from 'react';
import type { FloorNode, FloorConnection } from '@idle-rpg/shared';
import { useCanvasRenderer } from '../hooks/useCanvasRenderer';
import './FloorCanvas.css';

interface FloorCanvasProps {
  nodes: FloorNode[];
  connections: FloorConnection[];
  selectedNodeId: string | null;
  connectingFrom?: string | null;
  currentTool?: 'select' | 'place' | 'connect' | 'delete' | 'start_point';
  onNodeClick: (node: FloorNode) => void;
  onCanvasClick: (point: { x: number; y: number }) => void;
  onTransformChange?: (transform: { x: number; y: number; scale: number }) => void;
  width?: number;
  height?: number;
}

export default function FloorCanvas({
  nodes,
  connections,
  selectedNodeId,
  connectingFrom,
  currentTool = 'select',
  onNodeClick,
  onCanvasClick,
  onTransformChange,
  width = 1200,
  height = 800,
}: FloorCanvasProps) {
  const {
    canvasRef,
    transform,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useCanvasRenderer({
    nodes,
    connections,
    width,
    height,
    onNodeClick,
    onCanvasClick,
    selectedNodeId,
    connectingFrom: connectingFrom || null,
    currentTool,
    gridSize: 50,
    showGrid: true,
  });

  // Notify parent of transform changes
  useEffect(() => {
    onTransformChange?.(transform);
  }, [transform, onTransformChange]);

  return (
    <div className="floor-canvas-container">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={(e) => handleMouseUp(e)}
        className="floor-canvas"
      />
    </div>
  );
}

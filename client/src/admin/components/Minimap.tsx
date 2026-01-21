import { useRef, useEffect } from 'react';
import type { FloorNode, FloorConnection } from '@idle-rpg/shared';
import type { Transform } from '../hooks/useCanvasRenderer';
import './Minimap.css';

interface MinimapProps {
  nodes: FloorNode[];
  connections: FloorConnection[];
  transform: Transform;
  viewport: { width: number; height: number };
  onViewportChange: (transform: Transform) => void;
}

export default function Minimap({
  nodes,
  connections,
  transform,
  viewport,
  onViewportChange,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate bounds
    const minX = Math.min(...nodes.map(n => n.x_coordinate));
    const maxX = Math.max(...nodes.map(n => n.x_coordinate));
    const minY = Math.min(...nodes.map(n => n.y_coordinate));
    const maxY = Math.max(...nodes.map(n => n.y_coordinate));

    const width = maxX - minX || 1000;
    const height = maxY - minY || 1000;
    const padding = 50;

    const scaleX = (canvas.width - padding * 2) / width;
    const scaleY = (canvas.height - padding * 2) / height;
    const scale = Math.min(scaleX, scaleY);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw connections
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    for (const conn of connections) {
      const fromNode = nodes.find(n => n.id === conn.from_node_id);
      const toNode = nodes.find(n => n.id === conn.to_node_id);
      if (fromNode && toNode) {
        ctx.beginPath();
        ctx.moveTo(
          (fromNode.x_coordinate - minX) * scale + padding,
          (fromNode.y_coordinate - minY) * scale + padding
        );
        ctx.lineTo(
          (toNode.x_coordinate - minX) * scale + padding,
          (toNode.y_coordinate - minY) * scale + padding
        );
        ctx.stroke();
      }
    }

    // Draw nodes
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

    for (const node of nodes) {
      const x = (node.x_coordinate - minX) * scale + padding;
      const y = (node.y_coordinate - minY) * scale + padding;
      const color = nodeColors[node.node_type] || '#666';

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw viewport rectangle
    const viewportX = (transform.x - minX) * scale + padding;
    const viewportY = (transform.y - minY) * scale + padding;
    const viewportW = (viewport.width / transform.scale) * scale;
    const viewportH = (viewport.height / transform.scale) * scale;

    ctx.strokeStyle = '#6c5ce7';
    ctx.lineWidth = 2;
    ctx.strokeRect(viewportX, viewportY, viewportW, viewportH);
  }, [nodes, connections, transform, viewport]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate world coordinates
    const minX = Math.min(...nodes.map(n => n.x_coordinate));
    const minY = Math.min(...nodes.map(n => n.y_coordinate));
    const maxX = Math.max(...nodes.map(n => n.x_coordinate));
    const maxY = Math.max(...nodes.map(n => n.y_coordinate));

    const width = maxX - minX || 1000;
    const height = maxY - minY || 1000;
    const padding = 50;

    const scaleX = (canvas.width - padding * 2) / width;
    const scaleY = (canvas.height - padding * 2) / height;
    const scale = Math.min(scaleX, scaleY);

    const worldX = (x - padding) / scale + minX;
    const worldY = (y - padding) / scale + minY;

    // Center viewport on clicked location
    onViewportChange({
      x: worldX - viewport.width / (2 * transform.scale),
      y: worldY - viewport.height / (2 * transform.scale),
      scale: transform.scale,
    });
  };

  return (
    <div className="minimap-container" ref={minimapRef}>
      <canvas
        ref={canvasRef}
        width={200}
        height={200}
        onClick={handleClick}
        className="minimap-canvas"
      />
    </div>
  );
}

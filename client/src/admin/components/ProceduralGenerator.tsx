import { useState } from 'react';
import { AuthService } from '../AuthService';
import type { FloorNode, FloorConnection } from '@idle-rpg/shared';
import './ProceduralGenerator.css';

interface ProceduralGeneratorProps {
  floorId: string;
  labyrinthId: string;
  onGenerate: (nodes: FloorNode[], connections: FloorConnection[]) => void;
  onClose: () => void;
}

export default function ProceduralGenerator({
  floorId,
  labyrinthId,
  onGenerate,
  onClose,
}: ProceduralGeneratorProps) {
  const [config, setConfig] = useState({
    totalNodes: 100,
    bossCount: 5,
    safeZoneCount: 10,
    craftingCount: 10,
    stairCount: 3,
    startPointCount: 1,
    layoutType: 'maze' as 'maze' | 'hub_spoke' | 'linear' | 'random',
    connectionDensity: 0.5,
    replace: true,
  });
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const result = await AuthService.apiRequest<{
        success: boolean;
        nodes: FloorNode[];
        connections: FloorConnection[];
      }>(`/api/admin/labyrinths/${labyrinthId}/floors/${floorId}/generate`, {
        method: 'POST',
        body: JSON.stringify({ config }),
      });

      if (result.success) {
        onGenerate(result.nodes, result.connections);
        alert(`Generated ${result.nodes.length} nodes and ${result.connections.length} connections!`);
      }
    } catch (err) {
      alert('Failed to generate layout: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content procedural-generator-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Procedural Level Generator</h3>
          <button className="modal-close-button" onClick={onClose}>×</button>
        </div>
        <div className="generator-form">
          <div className="form-group">
            <label>Layout Type</label>
            <select
              value={config.layoutType}
              onChange={(e) => setConfig({ ...config, layoutType: e.target.value as any })}
            >
              <option value="maze">Maze</option>
              <option value="hub_spoke">Hub & Spoke</option>
              <option value="linear">Linear</option>
              <option value="random">Random</option>
            </select>
          </div>

          <div className="form-group">
            <label>Total POIs</label>
            <input
              type="number"
              value={config.totalNodes}
              onChange={(e) => setConfig({ ...config, totalNodes: parseInt(e.target.value) || 50 })}
              min="10"
              max="5000"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Boss Count</label>
              <input
                type="number"
                value={config.bossCount}
                onChange={(e) => setConfig({ ...config, bossCount: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>
            <div className="form-group">
              <label>Safe Zones</label>
              <input
                type="number"
                value={config.safeZoneCount}
                onChange={(e) => setConfig({ ...config, safeZoneCount: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Crafting Areas</label>
              <input
                type="number"
                value={config.craftingCount}
                onChange={(e) => setConfig({ ...config, craftingCount: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>
            <div className="form-group">
              <label>Stairs</label>
              <input
                type="number"
                value={config.stairCount}
                onChange={(e) => setConfig({ ...config, stairCount: parseInt(e.target.value) || 1 })}
                min="1"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Start Points</label>
            <input
              type="number"
              value={config.startPointCount}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 1;
                setConfig({ ...config, startPointCount: Math.min(Math.max(1, value), config.totalNodes) });
              }}
              min="1"
              max={config.totalNodes}
            />
            <div className="form-hint">
              Number of nodes that will be marked as start points. Players will randomly spawn at one of these.
            </div>
          </div>

          <div className="form-group">
            <label>Connection Density (0-1)</label>
            <input
              type="number"
              step="0.1"
              value={config.connectionDensity}
              onChange={(e) => setConfig({ ...config, connectionDensity: parseFloat(e.target.value) || 0.5 })}
              min="0.1"
              max="1"
            />
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={config.replace}
                onChange={(e) => setConfig({ ...config, replace: e.target.checked })}
              />
              Replace existing layout
            </label>
          </div>

          <div className="form-actions">
            <button className="btn-generate" onClick={handleGenerate} disabled={generating}>
              {generating ? 'Generating...' : 'Generate Layout'}
            </button>
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

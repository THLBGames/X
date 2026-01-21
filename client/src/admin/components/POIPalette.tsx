import { useState } from 'react';
import './POIPalette.css';

export type POIType = 
  | 'regular' 
  | 'monster_spawn' 
  | 'monster_spawner' 
  | 'boss' 
  | 'safe_zone' 
  | 'crafting' 
  | 'stairs' 
  | 'guild_hall';

interface POIPaletteProps {
  selectedType: string | null;
  onSelectType: (type: string | null) => void;
}

interface POIDefinition {
  type: POIType;
  label: string;
  icon: string;
  color: string;
  description: string;
}

const POI_TYPES: POIDefinition[] = [
  { type: 'regular', label: 'Regular Room', icon: '⬜', color: '#666', description: 'Standard room' },
  { type: 'monster_spawn', label: 'Monster Spawn', icon: '👹', color: '#95a5a6', description: 'Individual monster' },
  { type: 'monster_spawner', label: 'Monster Spawner', icon: '⚙️', color: '#e74c3c', description: 'Generates monsters' },
  { type: 'boss', label: 'Boss Room', icon: '👑', color: '#8e44ad', description: 'Boss encounter' },
  { type: 'safe_zone', label: 'Safe Zone', icon: '🛡️', color: '#3498db', description: 'Rest area' },
  { type: 'crafting', label: 'Crafting Area', icon: '🔨', color: '#f39c12', description: 'Crafting station' },
  { type: 'stairs', label: 'Stairs', icon: '🪜', color: '#2ecc71', description: 'Floor transition' },
  { type: 'guild_hall', label: 'Guild Hall', icon: '🏛️', color: '#9b59b6', description: 'Guild interaction' },
];

export default function POIPalette({ selectedType, onSelectType }: POIPaletteProps) {
  return (
    <div className="poi-palette">
      <h4>POI Types</h4>
      <div className="poi-list">
        {POI_TYPES.map(poi => (
          <div
            key={poi.type}
            className={`poi-item ${selectedType === poi.type ? 'selected' : ''}`}
            onClick={() => onSelectType(selectedType === poi.type ? null : poi.type)}
            style={{ borderLeftColor: poi.color }}
          >
            <div className="poi-icon" style={{ color: poi.color }}>
              {poi.icon}
            </div>
            <div className="poi-info">
              <div className="poi-label">{poi.label}</div>
              <div className="poi-description">{poi.description}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="poi-palette-footer">
        <button
          className="clear-selection"
          onClick={() => onSelectType(null)}
          disabled={!selectedType}
        >
          Clear Selection
        </button>
      </div>
    </div>
  );
}

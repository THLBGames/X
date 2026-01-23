import { useState } from 'react';
import './FloorEditor.css';

interface Floor {
  floor_number: number;
  max_players: number;
  monster_pool: any[];
  loot_table: any[];
  environment_type: string;
  rules: Record<string, any>;
}

interface FloorEditorProps {
  floor: Floor;
  onChange: (floor: Floor) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export default function FloorEditor({ floor, onChange, onRemove, canRemove }: FloorEditorProps) {
  const [showJson, setShowJson] = useState(false);

  const updateField = <K extends keyof Floor>(field: K, value: Floor[K]) => {
    onChange({ ...floor, [field]: value });
  };

  return (
    <div className="floor-editor">
      <div className="floor-editor-header">
        <h4>Floor {floor.floor_number}</h4>
        {canRemove && (
          <button type="button" className="btn-remove" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Max Players</label>
          <input
            type="number"
            value={floor.max_players}
            onChange={(e) => updateField('max_players', parseInt(e.target.value))}
            min="1"
          />
        </div>
        <div className="form-group">
          <label>Environment Type</label>
          <input
            type="text"
            value={floor.environment_type}
            onChange={(e) => updateField('environment_type', e.target.value)}
            placeholder="dungeon"
          />
        </div>
      </div>

      <div className="form-group">
        <label>
          Monster Pool (JSON)
          <button
            type="button"
            className="btn-toggle-json"
            onClick={() => setShowJson(!showJson)}
          >
            {showJson ? 'Hide' : 'Show'} Editor
          </button>
        </label>
        {showJson ? (
          <textarea
            value={JSON.stringify(floor.monster_pool, null, 2)}
            onChange={(e) => {
              try {
                updateField('monster_pool', JSON.parse(e.target.value));
              } catch (err) {
                // Invalid JSON, ignore for now
              }
            }}
            rows={8}
          />
        ) : (
          <div className="json-preview">
            {floor.monster_pool.length > 0 ? (
              <div>
                <div style={{ marginBottom: '8px', fontWeight: 600 }}>
                  {floor.monster_pool.length} monster{floor.monster_pool.length !== 1 ? 's' : ''} configured
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                  {floor.monster_pool.slice(0, 5).map((monster: any, index: number) => (
                    <div key={index} style={{ padding: '4px 8px', background: '#2a2a3e', borderRadius: '4px' }}>
                      <span style={{ fontWeight: 600, color: '#4a9eff' }}>
                        {monster.monsterId || monster.id || 'Unknown'}
                      </span>
                      {monster.weight !== undefined && (
                        <span style={{ marginLeft: '8px', color: '#aaa' }}>Weight: {monster.weight}</span>
                      )}
                      {monster.minLevel !== undefined && (
                        <span style={{ marginLeft: '8px', color: '#aaa' }}>Lv {monster.minLevel}</span>
                      )}
                      {monster.maxLevel !== undefined && (
                        <span style={{ marginLeft: '4px', color: '#aaa' }}>- {monster.maxLevel}</span>
                      )}
                    </div>
                  ))}
                  {floor.monster_pool.length > 5 && (
                    <div style={{ color: '#888', fontStyle: 'italic', fontSize: '0.8rem' }}>
                      ... and {floor.monster_pool.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ color: '#888', fontStyle: 'italic' }}>No monsters configured</div>
            )}
          </div>
        )}
      </div>

      <div className="form-group">
        <label>
          Loot Table (JSON)
          <button
            type="button"
            className="btn-toggle-json"
            onClick={() => setShowJson(!showJson)}
          >
            {showJson ? 'Hide' : 'Show'} Editor
          </button>
        </label>
        {showJson ? (
          <textarea
            value={JSON.stringify(floor.loot_table, null, 2)}
            onChange={(e) => {
              try {
                updateField('loot_table', JSON.parse(e.target.value));
              } catch (err) {
                // Invalid JSON, ignore for now
              }
            }}
            rows={8}
          />
        ) : (
          <div className="json-preview">
            {floor.loot_table.length} loot entries configured
          </div>
        )}
      </div>
    </div>
  );
}

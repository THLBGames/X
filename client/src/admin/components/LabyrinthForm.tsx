import { useState, useEffect } from 'react';
import { AuthService } from '../AuthService';
import FloorEditor from './FloorEditor';
import FloorDesigner from './FloorDesigner';
import './LabyrinthForm.css';

interface LabyrinthFormProps {
  labyrinthId: string | null;
  onSave: () => void;
  onCancel: () => void;
}

interface Floor {
  id?: string;
  floor_number: number;
  max_players: number;
  monster_pool: any[];
  loot_table: any[];
  environment_type: string;
  rules: Record<string, any>;
}

export default function LabyrinthForm({ labyrinthId, onSave, onCancel }: LabyrinthFormProps) {
  const [name, setName] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [totalFloors, setTotalFloors] = useState(1);
  const [maxInitialPlayers, setMaxInitialPlayers] = useState(100);
  const [rulesConfig, setRulesConfig] = useState<Record<string, any>>({});
  const [metadata, setMetadata] = useState<Record<string, any>>({});
  const [floors, setFloors] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [designingFloorId, setDesigningFloorId] = useState<string | null>(null);

  useEffect(() => {
    if (labyrinthId && labyrinthId !== 'new') {
      loadLabyrinth();
    } else {
      // Initialize with default floor
      setFloors([{
        floor_number: 1,
        max_players: 100,
        monster_pool: [],
        loot_table: [],
        environment_type: 'dungeon',
        rules: {},
      }]);
    }
  }, [labyrinthId]);

  const loadLabyrinth = async () => {
    try {
      setLoading(true);
      const data = await AuthService.apiRequest<{ success: boolean; labyrinth: any; floors: any[] }>(`/api/admin/labyrinths/${labyrinthId}`);
      if (data.success) {
        const lab = data.labyrinth;
        setName(lab.name);
        setScheduledStart(new Date(lab.scheduled_start).toISOString().slice(0, 16));
        setTotalFloors(lab.total_floors);
        setMaxInitialPlayers(lab.max_initial_players);
        setRulesConfig(lab.rules_config || {});
        setMetadata(lab.metadata || {});
        setFloors(data.floors.map(f => ({
          id: f.id, // Store floor ID for designer access
          floor_number: f.floor_number,
          max_players: f.max_players,
          monster_pool: f.monster_pool || [],
          loot_table: f.loot_table || [],
          environment_type: f.environment_type || 'dungeon',
          rules: f.rules || {},
        })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load labyrinth');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = {
        name,
        scheduled_start: scheduledStart,
        total_floors: floors.length,
        max_initial_players: maxInitialPlayers,
        rules_config: rulesConfig,
        metadata,
        floors,
      };

      if (labyrinthId === 'new') {
        await AuthService.apiRequest('/api/admin/labyrinths', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else {
        await AuthService.apiRequest(`/api/admin/labyrinths/${labyrinthId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save labyrinth');
    } finally {
      setLoading(false);
    }
  };

  const addFloor = () => {
    setFloors([...floors, {
      floor_number: floors.length + 1,
      max_players: Math.floor(maxInitialPlayers * 0.5),
      monster_pool: [],
      loot_table: [],
      environment_type: 'dungeon',
      rules: {},
    }]);
  };

  const updateFloor = (index: number, floor: Floor) => {
    const updated = [...floors];
    updated[index] = floor;
    setFloors(updated);
  };

  const removeFloor = (index: number) => {
    if (floors.length <= 1) {
      alert('At least one floor is required');
      return;
    }
    setFloors(floors.filter((_, i) => i !== index).map((f, i) => ({ ...f, floor_number: i + 1 })));
  };

  if (loading && labyrinthId && labyrinthId !== 'new') {
    return <div>Loading...</div>;
  }

  return (
    <div className="labyrinth-form">
      <h2>{labyrinthId === 'new' ? 'Create New Labyrinth' : 'Edit Labyrinth'}</h2>
      
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>Basic Information</h3>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Scheduled Start</label>
            <input
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Max Initial Players</label>
              <input
                type="number"
                value={maxInitialPlayers}
                onChange={(e) => setMaxInitialPlayers(parseInt(e.target.value))}
                required
                min="1"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Floors ({floors.length})</h3>
          {floors.map((floor, index) => (
            <div key={index} className="floor-editor-wrapper">
              <div className="floor-header">
                <h4>Floor {floor.floor_number}</h4>
                {labyrinthId && labyrinthId !== 'new' && floor.id && (
                  <button
                    type="button"
                    className="btn-design-floor"
                    onClick={() => setDesigningFloorId(floor.id!)}
                  >
                    🗺️ Design Floor Layout
                  </button>
                )}
              </div>
              <FloorEditor
                floor={floor}
                onChange={(updated) => updateFloor(index, updated)}
                onRemove={() => removeFloor(index)}
                canRemove={floors.length > 1}
              />
            </div>
          ))}
          <button type="button" className="btn-add-floor" onClick={addFloor}>
            + Add Floor
          </button>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Labyrinth'}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>

      {designingFloorId && labyrinthId && labyrinthId !== 'new' && (
        <div className="floor-designer-modal">
          <div className="floor-designer-modal-content">
            <div className="floor-designer-modal-header">
              <h2>Design Floor Layout</h2>
              <button className="close-button" onClick={() => setDesigningFloorId(null)}>×</button>
            </div>
            <FloorDesigner
              floorId={designingFloorId}
              labyrinthId={labyrinthId}
            />
          </div>
        </div>
      )}
    </div>
  );
}

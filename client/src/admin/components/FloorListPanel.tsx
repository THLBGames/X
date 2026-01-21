import { useState, useEffect } from 'react';
import { AuthService } from '../AuthService';
import './FloorListPanel.css';

interface Floor {
  id: string;
  floor_number: number;
  max_players: number;
  environment_type: string;
  time_limit_hours: number | null;
  created_at: string;
}

interface FloorListPanelProps {
  labyrinthId: string;
  selectedFloorId: string | null;
  onSelectFloor: (floorId: string) => void;
}

export default function FloorListPanel({
  labyrinthId,
  selectedFloorId,
  onSelectFloor,
}: FloorListPanelProps) {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFloors();
  }, [labyrinthId]);

  const loadFloors = async () => {
    try {
      setLoading(true);
      const result = await AuthService.apiRequest<{
        success: boolean;
        labyrinth: any;
        floors: Floor[];
      }>(`/api/admin/labyrinths/${labyrinthId}`);

      if (result.success && result.floors) {
        setFloors(result.floors);
        // Select first floor if none selected
        if (!selectedFloorId && result.floors.length > 0) {
          onSelectFloor(result.floors[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load floors:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="floor-list-panel">Loading floors...</div>;
  }

  return (
    <div className="floor-list-panel">
      <h4>Floors</h4>
      <div className="floor-list">
        {floors.map(floor => (
          <div
            key={floor.id}
            className={`floor-item ${selectedFloorId === floor.id ? 'selected' : ''}`}
            onClick={() => onSelectFloor(floor.id)}
          >
            <div className="floor-number">Floor {floor.floor_number}</div>
            <div className="floor-info">
              <span className="floor-env">{floor.environment_type}</span>
              {floor.time_limit_hours && (
                <span className="floor-time">{floor.time_limit_hours}h limit</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

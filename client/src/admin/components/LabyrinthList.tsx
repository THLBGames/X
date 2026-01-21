import { useState, useEffect } from 'react';
import { AuthService } from '../AuthService';
import './LabyrinthList.css';

interface Labyrinth {
  id: string;
  name: string;
  status: string;
  scheduled_start: string;
  total_floors: number;
  max_initial_players: number;
  created_at: string;
}

interface LabyrinthListProps {
  onEdit: (id: string) => void;
}

export default function LabyrinthList({ onEdit }: LabyrinthListProps) {
  const [labyrinths, setLabyrinths] = useState<Labyrinth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLabyrinths();
  }, []);

  const loadLabyrinths = async () => {
    try {
      setLoading(true);
      const data = await AuthService.apiRequest<{ success: boolean; labyrinths: Labyrinth[] }>('/api/admin/labyrinths');
      if (data.success) {
        setLabyrinths(data.labyrinths);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load labyrinths');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (id: string) => {
    if (!confirm('Are you sure you want to start this labyrinth?')) return;
    try {
      await AuthService.apiRequest(`/api/admin/labyrinths/${id}/start`, { method: 'POST' });
      loadLabyrinths();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start labyrinth');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this labyrinth?')) return;
    try {
      await AuthService.apiRequest(`/api/admin/labyrinths/${id}/cancel`, { method: 'POST' });
      loadLabyrinths();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel labyrinth');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this labyrinth? This action cannot be undone.')) return;
    try {
      await AuthService.apiRequest(`/api/admin/labyrinths/${id}`, { method: 'DELETE' });
      loadLabyrinths();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete labyrinth');
    }
  };

  if (loading) return <div>Loading labyrinths...</div>;
  if (error) return <div className="error-message">Error: {error}</div>;

  return (
    <div className="labyrinth-list">
      <div className="labyrinth-list-header">
        <h2>Labyrinths</h2>
        <button className="btn-primary" onClick={() => onEdit('new')}>
          Create New Labyrinth
        </button>
      </div>

      <table className="labyrinth-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Scheduled Start</th>
            <th>Floors</th>
            <th>Max Players</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {labyrinths.length === 0 ? (
            <tr>
              <td colSpan={7} className="empty-state">
                No labyrinths found. Create one to get started.
              </td>
            </tr>
          ) : (
            labyrinths.map((labyrinth) => (
              <tr key={labyrinth.id}>
                <td>{labyrinth.name}</td>
                <td>
                  <span className={`status-badge status-${labyrinth.status}`}>
                    {labyrinth.status}
                  </span>
                </td>
                <td>{new Date(labyrinth.scheduled_start).toLocaleString()}</td>
                <td>{labyrinth.total_floors}</td>
                <td>{labyrinth.max_initial_players}</td>
                <td>{new Date(labyrinth.created_at).toLocaleDateString()}</td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-edit" onClick={() => onEdit(labyrinth.id)}>
                      Edit
                    </button>
                    {labyrinth.status === 'scheduled' && (
                      <button className="btn-start" onClick={() => handleStart(labyrinth.id)}>
                        Start
                      </button>
                    )}
                    {(labyrinth.status === 'scheduled' || labyrinth.status === 'active') && (
                      <button className="btn-cancel" onClick={() => handleCancel(labyrinth.id)}>
                        Cancel
                      </button>
                    )}
                    {labyrinth.status !== 'active' && (
                      <button className="btn-delete" onClick={() => handleDelete(labyrinth.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LabyrinthClient } from '../systems/labyrinth/LabyrinthClient';
import { useLabyrinthState } from '../systems/labyrinth/LabyrinthState';
import type { Labyrinth } from '@idle-rpg/shared';
import './LabyrinthList.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface LabyrinthListProps {
  labyrinthClient: LabyrinthClient;
  characterId: string;
}

export default function LabyrinthList({ labyrinthClient, characterId }: LabyrinthListProps) {
  const { t } = useTranslation('ui');
  const [labyrinths, setLabyrinths] = useState<Labyrinth[]>([]);
  const [loading, setLoading] = useState(true);
  const setCurrentLabyrinth = useLabyrinthState((state) => state.setCurrentLabyrinth);

  useEffect(() => {
    fetchLabyrinths();
  }, []);

  const fetchLabyrinths = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${SERVER_URL}/api/labyrinth/list`);
      const result = await response.json();
      if (result.success) {
        setLabyrinths(result.labyrinths);
      }
    } catch (error) {
      console.error('Failed to fetch labyrinths:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinLabyrinth = (labyrinth: Labyrinth) => {
    if (!labyrinthClient.isConnected()) {
      alert('Not connected to server. Please wait...');
      return;
    }

    if (labyrinth.status === 'scheduled') {
      const scheduledDate = new Date(labyrinth.scheduled_start);
      const now = new Date();
      if (scheduledDate > now) {
        alert(`Labyrinth starts at ${scheduledDate.toLocaleString()}`);
        return;
      }
    }

    if (labyrinth.status !== 'active' && labyrinth.status !== 'scheduled') {
      alert('This labyrinth is not accepting new players');
      return;
    }

    setCurrentLabyrinth(labyrinth);
    labyrinthClient.joinLabyrinth(labyrinth.id, characterId);
  };

  if (loading) {
    return <div className="labyrinth-list-loading">{t('labyrinth.loading', { defaultValue: 'Loading...' })}</div>;
  }

  return (
    <div className="labyrinth-list">
      <h3>{t('labyrinth.availableLabyrinths', { defaultValue: 'Available Labyrinths' })}</h3>
      {labyrinths.length === 0 ? (
        <div className="labyrinth-list-empty">{t('labyrinth.noLabyrinths', { defaultValue: 'No labyrinths available' })}</div>
      ) : (
        <div className="labyrinth-items">
          {labyrinths.map((labyrinth) => (
            <div key={labyrinth.id} className={`labyrinth-item status-${labyrinth.status}`}>
              <div className="labyrinth-item-header">
                <h4>{labyrinth.name}</h4>
                <span className={`labyrinth-status status-${labyrinth.status}`}>
                  {labyrinth.status}
                </span>
              </div>
              <div className="labyrinth-item-details">
                <div className="labyrinth-detail">
                  <span className="detail-label">{t('labyrinth.floors', { defaultValue: 'Floors' })}:</span>
                  <span className="detail-value">{labyrinth.total_floors}</span>
                </div>
                <div className="labyrinth-detail">
                  <span className="detail-label">{t('labyrinth.maxPlayers', { defaultValue: 'Max Players' })}:</span>
                  <span className="detail-value">{labyrinth.max_initial_players}</span>
                </div>
                {labyrinth.scheduled_start && (
                  <div className="labyrinth-detail">
                    <span className="detail-label">{t('labyrinth.startTime', { defaultValue: 'Start Time' })}:</span>
                    <span className="detail-value">
                      {new Date(labyrinth.scheduled_start).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
              {(labyrinth.status === 'active' || labyrinth.status === 'scheduled') && (
                <button
                  className="labyrinth-join-button"
                  onClick={() => handleJoinLabyrinth(labyrinth)}
                  disabled={!labyrinthClient.isConnected()}
                >
                  {t('labyrinth.join', { defaultValue: 'Join Labyrinth' })}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

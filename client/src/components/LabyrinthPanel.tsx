import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameState } from '../systems';
import { LabyrinthClient } from '../systems/labyrinth/LabyrinthClient';
import { useLabyrinthState } from '../systems/labyrinth/LabyrinthState';
import LabyrinthList from './LabyrinthList';
import LabyrinthArena from './LabyrinthArena';
import LabyrinthRewards from './LabyrinthRewards';
import './LabyrinthPanel.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export default function LabyrinthPanel() {
  const { t } = useTranslation('ui');
  const character = useGameState((state) => state.character);
  const currentLabyrinth = useLabyrinthState((state) => state.currentLabyrinth);
  const [labyrinthClient, setLabyrinthClient] = useState<LabyrinthClient | null>(null);
  const [activeView, setActiveView] = useState<'list' | 'arena' | 'rewards'>('list');
  const [activeLabyrinths, setActiveLabyrinths] = useState<Array<{ labyrinth: any; participant: any }>>([]);

  useEffect(() => {
    if (!character) return;

    const client = new LabyrinthClient({
      onJoined: async (data) => {
        console.log('Joined labyrinth:', data);
        // Fetch labyrinth details and participant info
        const [labyrinthRes, participantRes] = await Promise.all([
          fetch(`${SERVER_URL}/api/labyrinth/${data.labyrinth_id}`),
          fetch(`${SERVER_URL}/api/labyrinth/${data.labyrinth_id}/participant/${character.id}`),
        ]);

        const labyrinthResult = await labyrinthRes.json();
        const participantResult = await participantRes.json();

        if (labyrinthResult.success) {
          useLabyrinthState.getState().setCurrentLabyrinth(labyrinthResult.labyrinth);
        }
        if (participantResult.success) {
          useLabyrinthState.getState().setCurrentParticipant(participantResult.participant);
        }
        
        // Refresh active labyrinths list
        const activeResponse = await fetch(`${SERVER_URL}/api/labyrinth/character/${character.id}/active`);
        const activeResult = await activeResponse.json();
        if (activeResult.success && activeResult.labyrinths) {
          setActiveLabyrinths(activeResult.labyrinths);
        }
        
        setActiveView('arena');
      },
      onError: (error) => {
        console.error('Labyrinth error:', error);
        alert(error.message || 'An error occurred');
      },
    });

    client.connect();
    setLabyrinthClient(client);

    // Check if player is already in a labyrinth
    const checkActiveLabyrinths = async () => {
      try {
        const response = await fetch(`${SERVER_URL}/api/labyrinth/character/${character.id}/active`);
        const result = await response.json();
        
        if (result.success && result.labyrinths && result.labyrinths.length > 0) {
          // Player is in at least one labyrinth
          setActiveLabyrinths(result.labyrinths);
          
          // Use the first one (most recent) as current
          const { labyrinth, participant } = result.labyrinths[0];
          
          if (labyrinth && participant) {
            useLabyrinthState.getState().setCurrentLabyrinth(labyrinth);
            useLabyrinthState.getState().setCurrentParticipant(participant);
            setActiveView('arena');
          }
        }
      } catch (error) {
        console.error('Failed to check active labyrinths:', error);
      }
    };

    // Wait a bit for the client to connect before checking
    const timeoutId = setTimeout(checkActiveLabyrinths, 1000);
    
    // Also refresh active labyrinths periodically
    const interval = setInterval(checkActiveLabyrinths, 30000); // Every 30 seconds
    
    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
      client.disconnect();
    };
  }, [character]);

  if (!character) {
    return (
      <div className="labyrinth-panel">
        <div className="labyrinth-message">{t('labyrinth.needCharacter')}</div>
      </div>
    );
  }

  const handleSwitchLabyrinth = (labyrinth: any, participant: any) => {
    useLabyrinthState.getState().setCurrentLabyrinth(labyrinth);
    useLabyrinthState.getState().setCurrentParticipant(participant);
    setActiveView('arena');
  };

  return (
    <div className="labyrinth-panel">
      <div className="labyrinth-header">
        <h2>{t('labyrinth.title', { defaultValue: 'Labyrinth' })}</h2>
        <div className="labyrinth-header-actions">
          <button
            className={`labyrinth-tab ${activeView === 'list' ? 'active' : ''}`}
            onClick={() => setActiveView('list')}
          >
            {t('labyrinth.list', { defaultValue: 'Browse' })}
          </button>
          {activeLabyrinths.length > 0 && (
            <button
              className={`labyrinth-tab ${activeView === 'arena' ? 'active' : ''}`}
              onClick={() => setActiveView('arena')}
            >
              {t('labyrinth.arena', { defaultValue: 'Arena' })} {activeLabyrinths.length > 1 && `(${activeLabyrinths.length})`}
            </button>
          )}
          <button
            className={`labyrinth-tab ${activeView === 'rewards' ? 'active' : ''}`}
            onClick={() => setActiveView('rewards')}
          >
            {t('labyrinth.rewards', { defaultValue: 'Rewards' })}
          </button>
        </div>
      </div>

      {activeLabyrinths.length > 1 && activeView === 'arena' && (
        <div className="labyrinth-switcher">
          <h3>{t('labyrinth.yourLabyrinths', { defaultValue: 'Your Labyrinths' })}</h3>
          <div className="labyrinth-switcher-list">
            {activeLabyrinths.map(({ labyrinth, participant }) => (
              <button
                key={labyrinth.id}
                className={`labyrinth-switcher-item ${currentLabyrinth?.id === labyrinth.id ? 'active' : ''}`}
                onClick={() => handleSwitchLabyrinth(labyrinth, participant)}
              >
                <div className="labyrinth-switcher-name">{labyrinth.name}</div>
                <div className="labyrinth-switcher-details">
                  Floor {participant.floor_number} / {labyrinth.total_floors} • {participant.status}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="labyrinth-content">
        {activeView === 'list' && labyrinthClient && (
          <LabyrinthList labyrinthClient={labyrinthClient} characterId={character.id} />
        )}
        {activeView === 'arena' && currentLabyrinth && labyrinthClient && (
          <LabyrinthArena labyrinth={currentLabyrinth} labyrinthClient={labyrinthClient} />
        )}
        {activeView === 'rewards' && <LabyrinthRewards labyrinthClient={labyrinthClient} />}
      </div>
    </div>
  );
}

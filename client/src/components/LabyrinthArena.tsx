import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameState } from '../systems';
import { LabyrinthClient } from '../systems/labyrinth/LabyrinthClient';
import { useLabyrinthState } from '../systems/labyrinth/LabyrinthState';
import type { Labyrinth, LabyrinthParticipant } from '@idle-rpg/shared';
import LabyrinthCombat from './LabyrinthCombat';
import LabyrinthMapView from './LabyrinthMapView';
import PartyManagement from './PartyManagement';
import './LabyrinthArena.css';

interface LabyrinthArenaProps {
  labyrinth: Labyrinth;
  labyrinthClient: LabyrinthClient;
}

export default function LabyrinthArena({ labyrinth, labyrinthClient }: LabyrinthArenaProps) {
  const { t } = useTranslation('ui');
  const character = useGameState((state) => state.character);
  const currentParticipant = useLabyrinthState((state) => state.currentParticipant);
  const floorPlayers = useLabyrinthState((state) => state.floorPlayers);
  const inCombat = useLabyrinthState((state) => state.inCombat);
  const setFloorPlayers = useLabyrinthState((state) => state.setFloorPlayers);

  useEffect(() => {
    if (!currentParticipant) return;

    // Fetch floor players periodically
    const fetchFloorPlayers = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'}/api/labyrinth/${labyrinth.id}/floor/${currentParticipant.floor_number}/players`
        );
        const result = await response.json();
        if (result.success) {
          setFloorPlayers(result.players);
        }
      } catch (error) {
        console.error('Failed to fetch floor players:', error);
      }
    };

    fetchFloorPlayers();
    const interval = setInterval(fetchFloorPlayers, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [labyrinth.id, currentParticipant?.floor_number, setFloorPlayers]);

  if (!currentParticipant) {
    return (
      <div className="labyrinth-arena">
        <div className="labyrinth-arena-message">{t('labyrinth.notJoined', { defaultValue: 'Not currently in a labyrinth' })}</div>
      </div>
    );
  }

  if (inCombat) {
    return <LabyrinthCombat labyrinthClient={labyrinthClient} />;
  }

  return (
    <div className="labyrinth-arena">
      <div className="labyrinth-arena-header">
        <h3>{labyrinth.name}</h3>
        <div className="labyrinth-floor-info">
          {t('labyrinth.floor', { defaultValue: 'Floor' })} {currentParticipant.floor_number} / {labyrinth.total_floors}
        </div>
      </div>

      <PartyManagement labyrinthClient={labyrinthClient} />

      <div className="labyrinth-arena-status">
        <div className="status-item">
          <span className="status-label">{t('labyrinth.status', { defaultValue: 'Status' })}:</span>
          <span className={`status-value status-${currentParticipant.status}`}>{currentParticipant.status}</span>
        </div>
        <div className="status-item">
          <span className="status-label">{t('labyrinth.playersOnFloor', { defaultValue: 'Players on Floor' })}:</span>
          <span className="status-value">{floorPlayers.length}</span>
        </div>
      </div>

      {/* Map View */}
      {character && (
        <div className="labyrinth-map-container">
          <LabyrinthMapView 
            labyrinthId={labyrinth.id} 
            characterId={character.id}
            labyrinthClient={labyrinthClient}
          />
        </div>
      )}

      <div className="labyrinth-arena-players">
        <h4>{t('labyrinth.playersOnFloor', { defaultValue: 'Players on Floor' })}</h4>
        {floorPlayers.length === 0 ? (
          <div className="no-players">{t('labyrinth.noPlayers', { defaultValue: 'No other players on this floor' })}</div>
        ) : (
          <div className="players-list">
            {floorPlayers.map((player) => (
              <div key={player.id} className="player-item">
                <span className="player-name">{player.character_id}</span>
                <span className={`player-status status-${player.status}`}>{player.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

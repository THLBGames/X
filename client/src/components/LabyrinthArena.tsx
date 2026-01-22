import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameState } from '../systems';
import { LabyrinthClient } from '../systems/labyrinth/LabyrinthClient';
import { useLabyrinthState } from '../systems/labyrinth/LabyrinthState';
import type { Labyrinth } from '@idle-rpg/shared';
import LabyrinthCombat from './LabyrinthCombat';
import LabyrinthMapView from './LabyrinthMapView';
import PartyManagement from './PartyManagement';
import CombatDisplay from './CombatDisplay';
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
  const combatPrepared = useLabyrinthState((state) => state.combatPrepared);
  const poiCombatActive = useLabyrinthState((state) => state.poiCombatActive);
  const poiCombatInstanceId = useLabyrinthState((state) => state.poiCombatInstanceId);
  // POI combat state - kept for potential future use
  // @ts-expect-error - poiCombatState kept for future display/use
  const poiCombatState = useLabyrinthState((state) => state.poiCombatState);
  const poiCombatWaveNumber = useLabyrinthState((state) => state.poiCombatWaveNumber);
  const poiCombatTotalWaves = useLabyrinthState((state) => state.poiCombatTotalWaves);
  const setFloorPlayers = useLabyrinthState((state) => state.setFloorPlayers);
  const setPOICombatActive = useLabyrinthState((state) => state.setPOICombatActive);
  const setPOICombatWave = useLabyrinthState((state) => state.setPOICombatWave);
  const setPOICombatState = useLabyrinthState((state) => state.setPOICombatState);
  const setCombatPrepared = useLabyrinthState((state) => state.setCombatPrepared);
  const setInCombat = useLabyrinthState((state) => state.setInCombat);
  const setCombatState = useLabyrinthState((state) => state.setCombatState);
  const setCombatActive = useGameState((state) => state.setCombatActive);
  const updateCombatState = useGameState((state) => state.updateCombatState);
  const startCombatWithMonsters = useGameState((state) => state.startCombatWithMonsters);
  const queueSkill = useGameState((state) => state.queueSkill);
  const queueConsumable = useGameState((state) => state.queueConsumable);

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

  // Setup regular combat event handlers (always active, not just when component is rendered)
  const [preparedCombatData, setPreparedCombatData] = useState<any>(null);

  useEffect(() => {
    if (!currentParticipant) return;

    const onCombatPrepared = (data: any) => {
      console.log('[LabyrinthArena] Combat prepared event received:', data);
      setCombatPrepared(true, data.combat_instance_id);
      setPreparedCombatData(data); // Store the combat data
    };

    const onCombatInitiated = (data: any) => {
      console.log('[LabyrinthArena] Combat initiated:', data);
      setInCombat(true, data.combat_instance_id);
      setCombatPrepared(false, null);
    };

    const onCombatState = (data: any) => {
      setCombatState(data);
    };

    const onCombatEnded = (data: any) => {
      console.log('[LabyrinthArena] Combat ended:', data);
      setInCombat(false, null);
      setCombatPrepared(false, null);
      setCombatState(null);
    };

    labyrinthClient.callbacks.onCombatPrepared = onCombatPrepared;
    labyrinthClient.callbacks.onCombatInitiated = onCombatInitiated;
    labyrinthClient.callbacks.onCombatState = onCombatState;
    labyrinthClient.callbacks.onCombatEnded = onCombatEnded;

    return () => {
      delete labyrinthClient.callbacks.onCombatPrepared;
      delete labyrinthClient.callbacks.onCombatInitiated;
      delete labyrinthClient.callbacks.onCombatState;
      delete labyrinthClient.callbacks.onCombatEnded;
    };
  }, [currentParticipant, labyrinthClient, setCombatPrepared, setInCombat, setCombatState]);

  // Setup POI combat event handlers
  useEffect(() => {
    if (!currentParticipant) return;

    const onPOICombatStarted = (data: any) => {
      setPOICombatActive(true, data.combat_instance_id);
      setPOICombatWave(data.wave_number, data.total_waves);
      // Set GameState combat active so CombatDisplay shows
      setCombatActive(true);
      
      // Initialize combat state with first wave monsters
      if (data.monsters && character) {
        startCombatWithMonsters(
          data.monsters.map((m: any) => ({
            id: m.id,
            name: m.name,
            stats: m.stats,
            currentHealth: m.stats.health,
            currentMana: m.stats.mana || 0,
            statusEffects: [],
            isAlive: true,
          })),
          data.wave_number - 1,
          false, // isBossRound
          character.combatStats.health,
          character.combatStats.health,
          character.combatStats.mana,
          character.combatStats.mana
        );
      }
    };

    const onPOICombatWaveStarted = (data: any) => {
      setPOICombatWave(data.wave_number, data.total_waves);
    };

    const onPOICombatWaveComplete = (_data: any) => {
      // Wave completed, next wave will start
    };

    const onPOICombatState = (data: any) => {
      setPOICombatState(data);
      
      // Convert POI combat state to GameState combat state format
      if (data.participants && character) {
        const playerParticipant = data.participants.find((p: any) => p.isPlayer);
        const monsterParticipants = data.participants.filter((p: any) => !p.isPlayer);
        
        if (playerParticipant) {
          // Update combat state
          updateCombatState({
            playerHealth: playerParticipant.currentHealth,
            playerMaxHealth: playerParticipant.stats.maxHealth,
            playerMana: playerParticipant.currentMana,
            playerMaxMana: playerParticipant.stats.maxMana,
            playerParty: [{
              id: playerParticipant.id,
              name: playerParticipant.name,
              isSummoned: false,
              currentHealth: playerParticipant.currentHealth,
              maxHealth: playerParticipant.stats.maxHealth,
              currentMana: playerParticipant.currentMana,
              maxMana: playerParticipant.stats.maxMana,
              level: character.level,
            }],
            monsters: monsterParticipants.map((m: any) => ({
              id: m.id,
              name: m.name,
              currentHealth: m.currentHealth,
              maxHealth: m.stats.maxHealth,
              level: 1, // TODO: Get from monster data
            })),
            recentActions: data.recent_actions || [],
            roundNumber: data.wave_number - 1,
            currentActor: data.current_actor?.isPlayer ? 'player' : 'monster',
            currentMonsterIndex: 0,
            turnNumber: data.recent_actions?.length || 0,
            isBossRound: false,
          });
        }
      }
    };

    const onPOICombatEnded = (data: any) => {
      setPOICombatActive(false, null);
      setPOICombatState(null);
      setCombatActive(false);
      
      // Process rewards if victory
      if (data.result === 'victory' && data.rewards) {
        // TODO: Apply rewards to character
        console.log('POI Combat rewards:', data.rewards);
      }
    };

    labyrinthClient.callbacks.onPOICombatStarted = onPOICombatStarted;
    labyrinthClient.callbacks.onPOICombatWaveStarted = onPOICombatWaveStarted;
    labyrinthClient.callbacks.onPOICombatWaveComplete = onPOICombatWaveComplete;
    labyrinthClient.callbacks.onPOICombatState = onPOICombatState;
    labyrinthClient.callbacks.onPOICombatEnded = onPOICombatEnded;

    return () => {
      delete labyrinthClient.callbacks.onPOICombatStarted;
      delete labyrinthClient.callbacks.onPOICombatWaveStarted;
      delete labyrinthClient.callbacks.onPOICombatWaveComplete;
      delete labyrinthClient.callbacks.onPOICombatState;
      delete labyrinthClient.callbacks.onPOICombatEnded;
    };
  }, [currentParticipant, character, labyrinthClient, setPOICombatActive, setPOICombatWave, setPOICombatState, setCombatActive, updateCombatState, startCombatWithMonsters]);

  // Handle POI combat actions (skills, items) - kept for future implementation
  // @ts-expect-error - handlePOICombatAction kept for future UI implementation
  const handlePOICombatAction = (actionType: 'skill' | 'item' | 'attack', skillId?: string, itemId?: string) => {
    if (!poiCombatInstanceId || !currentParticipant) return;

    if (actionType === 'skill' && skillId) {
      queueSkill(skillId);
      labyrinthClient.sendPOICombatAction(
        currentParticipant.id,
        poiCombatInstanceId,
        'skill',
        skillId
      );
    } else if (actionType === 'item' && itemId) {
      queueConsumable(itemId);
      labyrinthClient.sendPOICombatAction(
        currentParticipant.id,
        poiCombatInstanceId,
        'item',
        undefined,
        itemId
      );
    } else if (actionType === 'attack') {
      labyrinthClient.sendPOICombatAction(
        currentParticipant.id,
        poiCombatInstanceId,
        'attack'
      );
    }
  };

  if (!currentParticipant) {
    return (
      <div className="labyrinth-arena">
        <div className="labyrinth-arena-message">{t('labyrinth.notJoined', { defaultValue: 'Not currently in a labyrinth' })}</div>
      </div>
    );
  }

  // Show regular labyrinth combat (party combat) - either active or prepared
  if ((inCombat || combatPrepared) && !poiCombatActive) {
    return <LabyrinthCombat labyrinthClient={labyrinthClient} preparedCombatData={preparedCombatData} />;
  }

  return (
    <div className="labyrinth-arena">
      {/* POI Combat Display Overlay */}
      {poiCombatActive && (
        <div className="poi-combat-overlay">
          <div className="poi-combat-header">
            <div className="poi-combat-wave-info">
              {t('labyrinth.wave', { defaultValue: 'Wave' })} {poiCombatWaveNumber} / {poiCombatTotalWaves}
            </div>
          </div>
          <CombatDisplay />
        </div>
      )}
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

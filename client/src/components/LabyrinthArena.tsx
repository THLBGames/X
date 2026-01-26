import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameState } from '../systems';
import { LabyrinthClient } from '../systems/labyrinth/LabyrinthClient';
import { useLabyrinthState } from '../systems/labyrinth/LabyrinthState';
import { getDataLoader } from '../data';
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
        if (result.success && result.players) {
          // Deduplicate by character_id as a safety measure (server should already do this)
          const uniquePlayers = result.players.filter(
            (player: any, index: number, self: any[]) => 
              index === self.findIndex((p: any) => p.character_id === player.character_id)
          );
          setFloorPlayers(uniquePlayers);
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
  const poiCombatMonstersRef = useRef<Map<string, any>>(new Map());

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

    // Check if there's already active combat when component loads/rejoins
    // This handles the case where the player refreshes the page while in combat
    const checkActiveCombat = async () => {
      try {
        // Fetch current position to check if we're on a combat POI node
        const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
        const positionResponse = await fetch(
          `${SERVER_URL}/api/labyrinth/${labyrinth.id}/position?character_id=${character?.id}`
        );
        const positionResult = await positionResponse.json();
        
        if (positionResult.success && positionResult.position?.current_node_id && character) {
          // Fetch map data to check if current node has POI combat
          const mapResponse = await fetch(
            `${SERVER_URL}/api/labyrinth/${labyrinth.id}/map?character_id=${character.id}`
          );
          const mapResult = await mapResponse.json();
          
          if (mapResult.success && mapResult.map) {
            const currentNode = mapResult.map.nodes.find(
              (n: any) => n.id === positionResult.position.current_node_id
            );
            
            if (currentNode?.metadata?.poi_combat?.enabled) {
              // Try to start combat - server will resume if already active
              console.log('[LabyrinthArena] Checking for active POI combat on current node...');
              labyrinthClient.startPOICombat(
                currentParticipant.id,
                positionResult.position.current_node_id,
                character
              );
            }
          }
        }
      } catch (err) {
        // Silently handle - combat might not be active or error is expected
        console.log('[LabyrinthArena] No active combat found or error checking:', err);
      }
    };

    // Check for active combat after a short delay to ensure socket is connected
    let checkTimeout: NodeJS.Timeout | null = null;
    if (labyrinthClient.isConnected() && character) {
      checkTimeout = setTimeout(() => {
        checkActiveCombat();
      }, 1000);
    }

    const onPOICombatStarted = (data: any) => {
      setPOICombatActive(true, data.combat_instance_id);
      setPOICombatWave(data.wave_number, data.total_waves);
      // Set GameState combat active so CombatDisplay shows
      setCombatActive(true);
      
      // Store monster data for later use in combat state updates
      // Create a map of participant IDs to monster objects
      if (data.monsters) {
        const monsterMap = new Map<string, any>();
        data.monsters.forEach((m: any, index: number) => {
          // Participant IDs are typically in format "monsterId_index" or just "monsterId"
          const participantId = m.participantId || `monster_${m.id}_${index}`;
          monsterMap.set(participantId, m);
          // Also map by just the ID in case that's used
          if (m.id) {
            monsterMap.set(m.id, m);
          }
        });
        poiCombatMonstersRef.current = monsterMap;
      }
      
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
      
      // Update monster data for new wave
      if (data.monsters && data.monsters.length > 0) {
        const monsterMap = new Map<string, any>();
        data.monsters.forEach((m: any, index: number) => {
          const participantId = m.participantId || `monster_${m.id}_${index}`;
          monsterMap.set(participantId, m);
          if (m.id) {
            monsterMap.set(m.id, m);
          }
        });
        poiCombatMonstersRef.current = monsterMap;
      }
      
      // Initialize combat state with new wave monsters
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
          data.wave_number - 1, // wave_number is 1-indexed, roundNumber is 0-indexed
          false, // isBossRound - TODO: determine from wave data if needed
          character.combatStats.health, // Will be updated by server state
          character.combatStats.health,
          character.combatStats.mana, // Will be updated by server state
          character.combatStats.mana
        );
      }
    };

    const onPOICombatWaveComplete = (data: any) => {
      // Wave completed - combat has ended for this wave
      // The server handles ending combat after each wave
      console.log(`Wave ${data.completed_wave || '?'} of ${data.total_waves || '?'} completed`);
      if (data.has_more_waves) {
        console.log('More waves available');
      }
    };

    const onPOICombatState = (data: any) => {
      setPOICombatState(data);
      
      // Convert POI combat state to GameState combat state format
      if (data.participants && character) {
        const playerParticipant = data.participants.find((p: any) => p.isPlayer);
        const monsterParticipants = data.participants.filter((p: any) => !p.isPlayer);
        
        if (playerParticipant) {
          const dataLoader = getDataLoader();
          
          // Convert monster participants to ActiveMonsterState format
          const monsters = monsterParticipants.map((m: any) => {
            // Try to get monster data from stored map first
            let monster = poiCombatMonstersRef.current.get(m.id);
            
            // If not found, try to get from participant's monster property
            if (!monster) {
              monster = m.monster;
            }
            
            // If still not found, try to load by monsterId
            if (!monster && m.monsterId) {
              monster = dataLoader.getMonster(m.monsterId);
            }
            
            // If still no monster, try to extract from participant ID (format: "monsterId_index" or "monster_monsterId_index")
            if (!monster && m.id) {
              const parts = m.id.split('_');
              // Try different patterns
              if (parts.length >= 2 && parts[0] === 'monster') {
                // Format: "monster_monsterId_index"
                const monsterId = parts[1];
                monster = dataLoader.getMonster(monsterId);
              } else if (parts.length > 0) {
                // Format: "monsterId_index" or just "monsterId"
                const monsterId = parts[0];
                monster = dataLoader.getMonster(monsterId);
              }
            }
            
            // Fallback: create a minimal monster object if we can't find the data
            if (!monster) {
              console.warn('Could not find monster data for participant:', m.id, m);
              monster = {
                id: m.id || 'unknown',
                name: m.name || 'Unknown Monster',
                level: m.level || 1,
                isBoss: false,
                stats: m.stats || {},
              } as any;
            }
            
            return {
              monster,
              participantId: m.id,
              currentHealth: m.currentHealth,
              maxHealth: m.stats?.maxHealth || m.currentHealth,
            };
          });
          
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
            monsters,
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
      // End combat state - each wave is a separate combat encounter
      setPOICombatActive(false, null);
      setPOICombatState(null);
      setCombatActive(false);
      poiCombatMonstersRef.current.clear(); // Clear stored monsters
      
      // Process rewards if victory
      if (data.result === 'victory' && data.rewards) {
        // TODO: Apply rewards to character
        console.log('POI Combat wave completed - rewards:', data.rewards);
        console.log(`Wave ${data.wave_number || '?'} of ${data.total_waves || '?'} completed`);
        if (data.has_more_waves) {
          console.log('More waves available - next wave can be started');
        } else {
          console.log('All waves completed!');
        }
      } else if (data.result === 'defeat') {
        console.log('POI Combat ended - player defeated');
      }
    };

    labyrinthClient.callbacks.onPOICombatStarted = onPOICombatStarted;
    labyrinthClient.callbacks.onPOICombatWaveStarted = onPOICombatWaveStarted;
    labyrinthClient.callbacks.onPOICombatWaveComplete = onPOICombatWaveComplete;
    labyrinthClient.callbacks.onPOICombatState = onPOICombatState;
    labyrinthClient.callbacks.onPOICombatEnded = onPOICombatEnded;

    return () => {
      clearTimeout(checkTimeout);
      delete labyrinthClient.callbacks.onPOICombatStarted;
      delete labyrinthClient.callbacks.onPOICombatWaveStarted;
      delete labyrinthClient.callbacks.onPOICombatWaveComplete;
      delete labyrinthClient.callbacks.onPOICombatState;
      delete labyrinthClient.callbacks.onPOICombatEnded;
    };
  }, [currentParticipant, character, labyrinth, labyrinthClient, setPOICombatActive, setPOICombatWave, setPOICombatState, setCombatActive, updateCombatState, startCombatWithMonsters]);

  // Handle POI combat actions (skills, items) - server has full authority
  // @ts-expect-error - handlePOICombatAction kept for future UI implementation
  const handlePOICombatAction = (actionType: 'skill' | 'item' | 'attack', skillId?: string, itemId?: string) => {
    if (!poiCombatInstanceId || !currentParticipant) return;

    // Only send action to server - do NOT call queueSkill/queueConsumable
    // Those trigger local combat processing which conflicts with server authority
    if (actionType === 'skill' && skillId) {
      labyrinthClient.sendPOICombatAction(
        currentParticipant.id,
        poiCombatInstanceId,
        'skill',
        skillId
      );
    } else if (actionType === 'item' && itemId) {
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

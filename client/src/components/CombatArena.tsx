import { useRef, useEffect, useCallback } from 'react';
import { useGameState } from '../systems';
import { useDamageNumbers } from '../hooks/useDamageNumbers';
import HealthBar from './HealthBar';
import DamageNumber from './DamageNumber';
import CombatResultOverlay from './CombatResultOverlay';
import type { ActiveCombatState, ActivePlayerPartyMember, ActiveMonsterState } from '@idle-rpg/shared';
import './CombatArena.css';

interface CombatArenaProps {
  combatState: ActiveCombatState;
  showResult?: 'victory' | 'defeat' | null;
  onResultComplete?: () => void;
}

export default function CombatArena({
  combatState,
  showResult,
  onResultComplete,
}: CombatArenaProps) {
  const character = useGameState((state) => state.character);
  const arenaRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const monsterRef = useRef<HTMLDivElement>(null);
  const { damageNumbers, addDamageNumber, removeDamageNumber } = useDamageNumbers();

  // Calculate positions for damage numbers
  const getDamagePosition = useCallback((target: 'player' | 'monster') => {
    if (!arenaRef.current) return { x: 0, y: 0 };

    const arenaRect = arenaRef.current.getBoundingClientRect();
    const targetRef = target === 'player' ? playerRef.current : monsterRef.current;

    if (!targetRef) return { x: arenaRect.width / 2, y: arenaRect.height / 2 };

    const targetRect = targetRef.getBoundingClientRect();
    const relativeX = targetRect.left - arenaRect.left + targetRect.width / 2;
    const relativeY = targetRect.top - arenaRect.top + targetRect.height / 2;

    return { x: relativeX, y: relativeY };
  }, []);

  const settings = useGameState((state) => state.settings);

  // Watch for new combat actions to trigger damage numbers
  useEffect(() => {
    // Check if damage numbers are enabled
    if (!settings.showDamageNumbers) {
      return;
    }

    const lastAction = combatState.recentActions[combatState.recentActions.length - 1];
    if (!lastAction || !lastAction.damage) return;

    const isPlayerAction = lastAction.actorId === 'player';
    // For damage numbers, target the first monster area if player action, or player if monster action
    const target = isPlayerAction ? 'monster' : 'player';
    const position = getDamagePosition(target);

    // Determine if critical (could be enhanced with action metadata)
    const isCritical = lastAction.damage > (isPlayerAction ? 100 : 80); // Simple heuristic

    addDamageNumber({
      value: lastAction.damage,
      isCritical,
      isHealing: false,
      x: position.x,
      y: position.y,
    });
  }, [combatState.recentActions, addDamageNumber, getDamagePosition, settings.showDamageNumbers]);

  // Get player party (use new structure if available, fallback to old structure)
  // Check both if playerParty exists AND has elements
  let playerParty: ActivePlayerPartyMember[] = [];
  if (combatState.playerParty && combatState.playerParty.length > 0) {
    playerParty = combatState.playerParty;
  } else if (combatState.playerHealth !== undefined) {
    // Fallback to old structure
    playerParty = [
      {
        id: 'player',
        name: character?.name || 'You',
        isSummoned: false,
        currentHealth: combatState.playerHealth,
        maxHealth: combatState.playerMaxHealth,
        currentMana: combatState.playerMana,
        maxMana: combatState.playerMaxMana,
        level: character?.level,
      },
    ];
  }

  // Pad player party to 5 slots (player + 4 summon slots)
  const paddedPlayerParty: (ActivePlayerPartyMember | null)[] = [...playerParty];
  while (paddedPlayerParty.length < 5) {
    paddedPlayerParty.push(null);
  }

  // Pad monsters to 5 slots
  const monsters = combatState.monsters || [];
  const paddedMonsters: (ActiveMonsterState | null)[] = [...monsters];
  while (paddedMonsters.length < 5) {
    paddedMonsters.push(null);
  }

  const isPlayerPartyTurn =
    combatState.currentActor === 'player' || combatState.currentActor === 'summoned';
  const currentPlayerIndex = combatState.currentPlayerIndex ?? 0;

  return (
    <div className="combat-arena" ref={arenaRef}>
      <div className="player-party-container">
        {paddedPlayerParty.map((partyMember, index) => {
          if (!partyMember) {
            return (
              <div key={`empty-slot-${index}`} className="combat-participant empty-slot">
                <div className="participant-name" style={{ color: '#555', fontStyle: 'italic' }}>
                  Empty Slot
                </div>
              </div>
            );
          }

          const isCurrentActor = isPlayerPartyTurn && index === currentPlayerIndex;
          const isPlayer = !partyMember.isSummoned;

          return (
            <div
              key={`party-${partyMember.id}-${index}`}
              className={`combat-participant player-area ${isCurrentActor ? 'active-turn' : ''} ${isPlayer ? 'player-character' : 'summoned-character'}`}
              ref={isPlayer && index === 0 ? playerRef : undefined}
            >
              <div className="participant-header">
                <div className={isPlayer ? 'player-icon' : 'summoned-icon'}>
                  <div className={isPlayer ? 'player-icon-inner' : 'summoned-icon-inner'}>
                    {isPlayer ? '⚔️' : '✨'}
                  </div>
                </div>
                <div className="participant-info">
                  <div className="participant-name">{partyMember.name}</div>
                  {partyMember.level !== undefined && (
                    <div className="participant-level">Lv. {partyMember.level}</div>
                  )}
                </div>
              </div>
              <HealthBar
                current={partyMember.currentHealth}
                max={partyMember.maxHealth}
                label="HP"
                barColor={isPlayer ? '#4a9eff' : '#4ecdc4'}
                height={12}
              />
              <HealthBar
                current={partyMember.currentMana}
                max={partyMember.maxMana}
                label="MP"
                barColor="#9b59b6"
                height={12}
              />
            </div>
          );
        })}
      </div>

      <div className="combat-vs">
        VS
        <br />
        Round {combatState.roundNumber + 1}
      </div>

      <div className="monsters-container">
        {paddedMonsters.map((monsterState, index) => {
          if (!monsterState) {
            return (
              <div key={`empty-monster-slot-${index}`} className="combat-participant empty-slot">
                <div className="participant-name" style={{ color: '#555', fontStyle: 'italic' }}>
                  Empty Slot
                </div>
              </div>
            );
          }

          if (monsterState.currentHealth <= 0) {
            return null; // Don't render dead monsters
          }

          const isCurrentMonster = !isPlayerPartyTurn && index === combatState.currentMonsterIndex;

          return (
            <div
              key={`monster-${index}-${monsterState.monster.id}`}
              className={`combat-participant monster-area ${isCurrentMonster ? 'active-turn' : ''} ${monsterState.monster.isBoss ? 'boss-monster' : ''}`}
              ref={index === 0 ? monsterRef : undefined}
            >
              <div className="participant-header">
                <div className="monster-image-placeholder">
                  <div className="monster-icon">👹</div>
                </div>
                <div className="participant-info">
                  <div className="participant-name">
                    {monsterState.monster.name}
                    {monsterState.monster.isBoss && ' [BOSS]'}
                  </div>
                  <div className="participant-level">Lv. {monsterState.monster.level}</div>
                </div>
              </div>
              <HealthBar
                current={monsterState.currentHealth}
                max={monsterState.maxHealth}
                label="HP"
                barColor={monsterState.monster.isBoss ? '#ff4444' : '#ff6b6b'}
                height={12}
              />
            </div>
          );
        })}
      </div>

      {/* Damage Numbers */}
      {settings.showDamageNumbers &&
        damageNumbers.map((damage) => (
          <DamageNumber
            key={damage.id}
            value={damage.value}
            isCritical={damage.isCritical}
            isHealing={damage.isHealing}
            x={damage.x}
            y={damage.y}
            onComplete={() => removeDamageNumber(damage.id)}
          />
        ))}

      {/* Victory/Defeat Overlay */}
      {showResult && onResultComplete && (
        <CombatResultOverlay result={showResult} onComplete={onResultComplete} />
      )}
    </div>
  );
}

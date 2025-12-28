import { useRef, useEffect, useCallback } from 'react';
import { useGameState } from '../systems';
import { useDamageNumbers } from '../hooks/useDamageNumbers';
import HealthBar from './HealthBar';
import DamageNumber from './DamageNumber';
import CombatResultOverlay from './CombatResultOverlay';
import type { ActiveCombatState } from '@idle-rpg/shared';
import './CombatArena.css';

interface CombatArenaProps {
  combatState: ActiveCombatState;
  showResult?: 'victory' | 'defeat' | null;
  onResultComplete?: () => void;
}

export default function CombatArena({ combatState, showResult, onResultComplete }: CombatArenaProps) {
  const character = useGameState((state) => state.character);
  const arenaRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const monsterRef = useRef<HTMLDivElement>(null);
  const { damageNumbers, addDamageNumber, removeDamageNumber } = useDamageNumbers();

  // Debug: log combat state
  useEffect(() => {
    console.log('CombatArena - combatState:', combatState);
    console.log('CombatArena - monsters:', combatState?.monsters);
  }, [combatState]);

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

  // Watch for new combat actions to trigger damage numbers
  useEffect(() => {
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
  }, [combatState.recentActions, addDamageNumber, getDamagePosition]);

  const isPlayerTurn = combatState.currentActor === 'player';

  return (
    <div className="combat-arena" ref={arenaRef}>
      <div className={`combat-participant player-area ${isPlayerTurn ? 'active-turn' : ''}`} ref={playerRef}>
        <div className="participant-info">
          <div className="participant-name">{character?.name || 'You'}</div>
          <div className="participant-level">Lv. {character?.level || '?'}</div>
        </div>
        <HealthBar
          current={combatState.playerHealth}
          max={combatState.playerMaxHealth}
          label="Health"
          barColor="#4a9eff"
        />
        <HealthBar
          current={combatState.playerMana}
          max={combatState.playerMaxMana}
          label="Mana"
          barColor="#4ecdc4"
          height={16}
        />
        {isPlayerTurn && <div className="turn-indicator">Your Turn</div>}
      </div>

      <div className="combat-vs">VS Round {combatState.roundNumber + 1}</div>

      <div className="monsters-container">
        {combatState.monsters && combatState.monsters.length > 0 ? (
          combatState.monsters
            .filter((m) => m.currentHealth > 0)
            .map((monsterState, index) => {
            const isCurrentMonster =
              !isPlayerTurn && index === combatState.currentMonsterIndex;
            return (
              <div
                key={`monster-${index}-${monsterState.monster.id}`}
                className={`combat-participant monster-area ${isCurrentMonster ? 'active-turn' : ''} ${monsterState.monster.isBoss ? 'boss-monster' : ''}`}
                ref={index === 0 ? monsterRef : undefined}
              >
                <div className="monster-image-placeholder">
                  {/* Placeholder for monster image/icon */}
                  <div className="monster-icon">👹</div>
                </div>
                <div className="participant-info">
                  <div className="participant-name">
                    {monsterState.monster.name}
                    {monsterState.monster.isBoss && ' [BOSS]'}
                  </div>
                  <div className="participant-level">Lv. {monsterState.monster.level}</div>
                </div>
                <HealthBar
                  current={monsterState.currentHealth}
                  max={monsterState.maxHealth}
                  label="Health"
                  barColor={monsterState.monster.isBoss ? '#ff4444' : '#ff6b6b'}
                />
                {isCurrentMonster && <div className="turn-indicator">Enemy Turn</div>}
              </div>
            );
          })
        ) : (
          <div className="combat-loading">Loading monsters...</div>
        )}
      </div>

      {/* Damage Numbers */}
      {damageNumbers.map((damage) => (
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


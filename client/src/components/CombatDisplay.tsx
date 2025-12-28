import { useState, useEffect, useRef } from 'react';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import CombatArena from './CombatArena';
import ActionLog from './ActionLog';
import CombatSkillBar from './CombatSkillBar';
import type { CombatLog as CombatLogType } from '@idle-rpg/shared';
import './CombatDisplay.css';

interface CombatStats {
  combatsCompleted: number;
  totalExperience: number;
  totalGold: number;
}

export default function CombatDisplay() {
  const isCombatActive = useGameState((state) => state.isCombatActive);
  const character = useGameState((state) => state.character);
  const currentDungeonId = useGameState((state) => state.currentDungeonId);
  const stopCombat = useGameState((state) => state.stopCombat);
  const currentCombatState = useGameState((state) => state.currentCombatState);
  const queueSkill = useGameState((state) => state.queueSkill);
  
  const [combatStats, setCombatStats] = useState<CombatStats>({
    combatsCompleted: 0,
    totalExperience: 0,
    totalGold: 0,
  });
  const [levelUpMessage, setLevelUpMessage] = useState<string | null>(null);
  const [combatResult, setCombatResult] = useState<'victory' | 'defeat' | null>(null);
  const previousLevelRef = useRef(character?.level || 1);

  // Listen for combat stats updates
  useEffect(() => {
    const handleStatsUpdate = (event: CustomEvent) => {
      setCombatStats(event.detail);
    };

    window.addEventListener('combatStatsUpdate' as any, handleStatsUpdate);
    return () => {
      window.removeEventListener('combatStatsUpdate' as any, handleStatsUpdate);
    };
  }, []);

  // Watch for level ups
  useEffect(() => {
    if (character && character.level > previousLevelRef.current) {
      const levelsGained = character.level - previousLevelRef.current;
      setLevelUpMessage(`Level Up! You are now level ${character.level}!`);
      previousLevelRef.current = character.level;
      
      // Clear message after 5 seconds
      setTimeout(() => {
        setLevelUpMessage(null);
      }, 5000);
    }
  }, [character?.level]);

  useEffect(() => {
    if (!isCombatActive) {
      // Reset stats when combat stops
      setCombatStats({
        combatsCompleted: 0,
        totalExperience: 0,
        totalGold: 0,
      });
      previousLevelRef.current = character?.level || 1;
    }
  }, [isCombatActive, character?.level]);

  const dataLoader = getDataLoader();
  const dungeon = currentDungeonId ? dataLoader.getDungeon(currentDungeonId) : null;

  const handleSkillUse = (skillId: string) => {
    queueSkill(skillId);
  };

  return (
    <div className="combat-display">
      <div className="combat-header">
        <h2>Combat</h2>
        {isCombatActive && (
          <button className="stop-combat-button" onClick={stopCombat}>
            Stop Combat
          </button>
        )}
      </div>

      {isCombatActive ? (
        <div className="combat-active">
          {currentCombatState ? (
            <>
              <CombatArena combatState={currentCombatState} />
              
              <CombatSkillBar onSkillUse={handleSkillUse} />

              <ActionLog actions={currentCombatState.recentActions} />

              {combatStats.combatsCompleted > 0 && (
                <div className="combat-stats">
                  <h3>Session Statistics</h3>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <div className="stat-label">Combats</div>
                      <div className="stat-value">{combatStats.combatsCompleted}</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-label">Experience</div>
                      <div className="stat-value">+{combatStats.totalExperience}</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-label">Gold</div>
                      <div className="stat-value">+{combatStats.totalGold}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="combat-loading">Initializing combat...</div>
          )}
        </div>
      ) : (
        <div className="combat-idle">
          <div className="idle-message">
            <div className="idle-icon">⚔️</div>
            <div>Idle - Select a dungeon to begin combat</div>
            <div className="idle-hint">
              Choose a dungeon from the list below and click "Start Combat"
            </div>
          </div>
        </div>
      )}

      {levelUpMessage && (
        <div className="level-up-notification">
          {levelUpMessage}
        </div>
      )}
    </div>
  );
}

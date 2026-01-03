import { useState, useEffect, useRef } from 'react';
import { useGameState } from '../systems';
// import { getDataLoader } from '../data';
import { audioManager } from '../systems/audio/AudioManager';
import { gameEventEmitter, type GameEvent } from '../systems/events/GameEventEmitter';
import CombatArena from './CombatArena';
import CombatSkillBar from './CombatSkillBar';
import ConsumableBar from './ConsumableBar';
import './CombatDisplay.css';

interface CombatStats {
  combatsCompleted: number;
  totalExperience: number;
  totalGold: number;
}

export default function CombatDisplay() {
  const isCombatActive = useGameState((state) => state.isCombatActive);
  const character = useGameState((state) => state.character);
  // const currentDungeonId = useGameState((state) => state.currentDungeonId);
  const stopCombat = useGameState((state) => state.stopCombat);
  const currentCombatState = useGameState((state) => state.currentCombatState);
  const queueSkill = useGameState((state) => state.queueSkill);
  const queueConsumable = useGameState((state) => state.queueConsumable);
  const settings = useGameState((state) => state.settings);

  const [combatStats, setCombatStats] = useState<CombatStats>({
    combatsCompleted: 0,
    totalExperience: 0,
    totalGold: 0,
  });
  const [levelUpMessage, setLevelUpMessage] = useState<string | null>(null);
  const previousLevelRef = useRef(character?.level || 1);

  // Listen for combat stats updates
  useEffect(() => {
    const handleStatsUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<CombatStats>;
      setCombatStats(customEvent.detail);
    };

    window.addEventListener('combatStatsUpdate', handleStatsUpdate);
    return () => {
      window.removeEventListener('combatStatsUpdate', handleStatsUpdate);
    };
  }, []);

  // Listen to level_up events from the game event system
  useEffect(() => {
    const handleLevelUp = (event: GameEvent) => {
      if (event.type !== 'level_up') return;

      const newLevel = event.newLevel;
      const message = `Level Up! You are now level ${newLevel}!`;
      setLevelUpMessage(message);
      previousLevelRef.current = newLevel;

      // Play level up sound
      audioManager.playSound('/audio/sfx/level_up.mp3', 0.8);

      // Show notification if enabled
      if (settings.showNotifications && typeof window !== 'undefined') {
        const notificationEvent = new CustomEvent('showNotification', {
          detail: {
            message,
            type: 'level-up',
            duration: 5000,
          },
        });
        window.dispatchEvent(notificationEvent);
      }

      // Clear message after 5 seconds
      setTimeout(() => {
        setLevelUpMessage(null);
      }, 5000);
    };

    // Subscribe to level_up events
    const unsubscribe = gameEventEmitter.on(handleLevelUp);

    return () => {
      unsubscribe();
    };
  }, [settings.showNotifications]);

  // Also watch state changes as a fallback (in case event is missed or character is loaded)
  useEffect(() => {
    if (character && character.level > previousLevelRef.current) {
      // Only show UI if we haven't already handled this level via event
      // This prevents duplicate notifications
      if (previousLevelRef.current < character.level) {
        previousLevelRef.current = character.level;
        // Note: We don't show notification here to avoid duplicates
        // The event listener above handles the UI updates
      }
    }
  }, [character]);

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

  // const dataLoader = getDataLoader();
  // Dungeon data available if needed
  // const dungeon = currentDungeonId ? dataLoader.getDungeon(currentDungeonId) : null;

  const handleSkillUse = (skillId: string) => {
    queueSkill(skillId);
  };

  const handleConsumableUse = (itemId: string) => {
    queueConsumable(itemId);
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
              <ConsumableBar onConsumableUse={handleConsumableUse} />

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

      {levelUpMessage && settings.showNotifications && (
        <div className="level-up-notification">{levelUpMessage}</div>
      )}
    </div>
  );
}

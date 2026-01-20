import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { audioManager } from '../systems/audio/AudioManager';
import { gameEventEmitter, type GameEvent } from '../systems/events/GameEventEmitter';
import CombatArena from './CombatArena';
import CombatSkillBar from './CombatSkillBar';
import ConsumableBar from './ConsumableBar';
import CombatGuideModal from './CombatGuideModal';
import './CombatDisplay.css';

interface CombatStats {
  combatsCompleted: number;
  totalExperience: number;
  totalGold: number;
  items: Array<{ itemId: string; quantity: number }>;
}

export default function CombatDisplay() {
  const { t } = useTranslation('ui');
  const isCombatActive = useGameState((state) => state.isCombatActive);
  const character = useGameState((state) => state.character);
  // const currentDungeonId = useGameState((state) => state.currentDungeonId);
  const stopCombat = useGameState((state) => state.stopCombat);
  const currentCombatState = useGameState((state) => state.currentCombatState);
  const isRoundDelay = useGameState((state) => state.isRoundDelay);
  const queueSkill = useGameState((state) => state.queueSkill);
  const queueConsumable = useGameState((state) => state.queueConsumable);
  const settings = useGameState((state) => state.settings);

  const [combatStats, setCombatStats] = useState<CombatStats>({
    combatsCompleted: 0,
    totalExperience: 0,
    totalGold: 0,
    items: [],
  });
  const [levelUpMessage, setLevelUpMessage] = useState<string | null>(null);
  const [showCombatGuide, setShowCombatGuide] = useState(false);
  const previousLevelRef = useRef(character?.level || 1);

  // Listen for combat stats updates
  useEffect(() => {
    const handleStatsUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<CombatStats>;
      setCombatStats({
        combatsCompleted: customEvent.detail.combatsCompleted || 0,
        totalExperience: customEvent.detail.totalExperience || 0,
        totalGold: customEvent.detail.totalGold || 0,
        items: customEvent.detail.items || [],
      });
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
      const message = t('combat.levelUp', { level: newLevel });
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
        items: [],
      });
      previousLevelRef.current = character?.level || 1;
    }
  }, [isCombatActive, character?.level]);

  const dataLoader = getDataLoader();

  const handleSkillUse = (skillId: string) => {
    queueSkill(skillId);
  };

  const handleConsumableUse = (itemId: string) => {
    queueConsumable(itemId);
  };

  return (
    <div className="combat-display">
      <div className="combat-header">
        <h2>{t('character.combat')}</h2>
        <div className="combat-header-actions">
          <button className="combat-guide-button" onClick={() => setShowCombatGuide(true)}>
            {t('combat.guideButton')}
          </button>
          {isCombatActive && (
            <button className="stop-combat-button" onClick={stopCombat}>
              {t('combat.stopCombat')}
            </button>
          )}
        </div>
      </div>

      {isCombatActive ? (
        <div className="combat-active">
          {isRoundDelay ? (
            <div className="round-delay-indicator">
              <div className="loading-spinner"></div>
              <div className="delay-message">{t('combat.roundDelay', { defaultValue: 'Preparing next round...' })}</div>
            </div>
          ) : currentCombatState ? (
            <>
              <CombatArena combatState={currentCombatState} />

              <CombatSkillBar onSkillUse={handleSkillUse} />
              <ConsumableBar onConsumableUse={handleConsumableUse} />

              {combatStats.combatsCompleted > 0 && (
                <div className="combat-stats">
                  <h3>{t('combat.sessionStatistics')}</h3>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <div className="stat-label">{t('combat.combats')}</div>
                      <div className="stat-value">{combatStats.combatsCompleted}</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-label">{t('character.experience')}</div>
                      <div className="stat-value">+{combatStats.totalExperience}</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-label">{t('character.gold')}</div>
                      <div className="stat-value">+{combatStats.totalGold}</div>
                    </div>
                  </div>
                </div>
              )}

              {(combatStats.items.length > 0 || combatStats.totalGold > 0) && (
                <div className="combat-loot">
                  <h3>{t('combat.lootReceived', { defaultValue: 'Loot Received' })}</h3>
                  {combatStats.totalGold > 0 && (
                    <div className="loot-gold">
                      <span className="gold-icon">💰</span>
                      <span className="gold-amount">+{combatStats.totalGold} Gold</span>
                    </div>
                  )}
                  {combatStats.items.length > 0 && (
                    <div className="loot-items">
                      {combatStats.items.map((item, idx) => {
                        const itemData = dataLoader.getItem(item.itemId);
                        const itemName = itemData ? dataLoader.getTranslatedName(itemData) : item.itemId;
                        const itemRarity = itemData?.rarity || 'common';
                        return (
                          <div key={idx} className={`loot-item rarity-${itemRarity}`}>
                            <span className="loot-item-name">{itemName}</span>
                            <span className="loot-item-quantity">x{item.quantity}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
          {!isRoundDelay && !currentCombatState && (
            <div className="combat-loading">{t('combat.initializing')}</div>
          )}
        </div>
      ) : (
        <div className="combat-idle">
          <div className="idle-message">
            <div className="idle-icon">⚔️</div>
            <div>{t('combat.idleMessage')}</div>
            <div className="idle-hint">
              {t('combat.idleHint')}
            </div>
          </div>
        </div>
      )}

      {levelUpMessage && settings.showNotifications && (
        <div className="level-up-notification">{levelUpMessage}</div>
      )}

      <CombatGuideModal isOpen={showCombatGuide} onClose={() => setShowCombatGuide(false)} />
    </div>
  );
}

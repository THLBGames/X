import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { DungeonManager } from '../systems/dungeon';
import type { Dungeon } from '@idle-rpg/shared';
import './DungeonSelector.css';

export default function DungeonSelector() {
  const { t } = useTranslation('ui');
  const character = useGameState((state) => state.character);
  const dungeonProgress = useGameState((state) => state.dungeonProgress);
  const currentDungeonId = useGameState((state) => state.currentDungeonId);
  const setCurrentDungeon = useGameState((state) => state.setCurrentDungeon);
  const startCombat = useGameState((state) => state.startCombat);
  const unlockDungeon = useGameState((state) => state.unlockDungeon);
  const dataLoader = getDataLoader();

  const [selectedDungeonId, setSelectedDungeonId] = useState<string | null>(currentDungeonId);
  const lastSyncedLevelRef = useRef<number>(0);

  // Note: availableDungeons was calculated but never used - component uses allDungeons directly

  useEffect(() => {
    setSelectedDungeonId(currentDungeonId);
  }, [currentDungeonId]);

  // Listen for dungeonProgress updates from event system
  useEffect(() => {
    const handleDungeonProgressUpdate = (event: CustomEvent) => {
      console.log('[DungeonSelector] Received dungeonProgressUpdated event:', event.detail);
      // Force a re-render by accessing the state
      // The useGameState hook will automatically trigger a re-render when dungeonProgress changes
    };

    window.addEventListener('dungeonProgressUpdated', handleDungeonProgressUpdate as EventListener);
    return () => {
      window.removeEventListener(
        'dungeonProgressUpdated',
        handleDungeonProgressUpdate as EventListener
      );
    };
  }, []);

  // Sync dungeon unlocks when character level changes or when character is first loaded
  useEffect(() => {
    if (!character) return;

    const currentLevel = character.level;

    // Only sync if level changed or if we haven't synced yet
    if (currentLevel !== lastSyncedLevelRef.current) {
      lastSyncedLevelRef.current = currentLevel;

      // Sync dungeon unlocks based on current character level
      const dataLoader = getDataLoader();
      const allDungeons = dataLoader.getAllDungeons();
      const completedDungeonIds = dungeonProgress
        .filter((dp) => dp.completed)
        .map((dp) => dp.dungeonId);

      let syncedCount = 0;
      for (const dungeon of allDungeons) {
        // Check if dungeon is already unlocked
        const existingProgress = dungeonProgress.find((dp) => dp.dungeonId === dungeon.id);
        if (existingProgress?.unlocked) {
          continue; // Already unlocked
        }

        // Check if dungeon should be unlocked based on current level and completed dungeons
        if (DungeonManager.isDungeonUnlocked(dungeon, currentLevel, completedDungeonIds)) {
          unlockDungeon(dungeon.id);
          syncedCount++;
        }
      }

      if (syncedCount > 0) {
        console.log(`[DungeonSelector] Synced ${syncedCount} dungeon(s) for level ${currentLevel}`);
      }
    }
  }, [character, dungeonProgress, unlockDungeon]);

  const handleDungeonSelect = (dungeonId: string) => {
    setSelectedDungeonId(dungeonId);
    setCurrentDungeon(dungeonId);
  };

  const handleStartCombat = () => {
    if (selectedDungeonId) {
      try {
        startCombat(selectedDungeonId);
      } catch (error) {
        console.error('Failed to start combat:', error);
        alert(t('combat.failedToStart'));
      }
    }
  };

  const getDungeonProgress = (dungeonId: string) => {
    return dungeonProgress.find((p) => p.dungeonId === dungeonId);
  };

  const isDungeonUnlocked = (dungeon: Dungeon): boolean => {
    if (!character) return false;
    const progress = getDungeonProgress(dungeon.id);
    if (progress?.unlocked) return true;

    const completedDungeonIds = dungeonProgress.filter((p) => p.completed).map((p) => p.dungeonId);
    return DungeonManager.isDungeonUnlocked(dungeon, character.level, completedDungeonIds);
  };

  if (!character) {
    return null;
  }

  const allDungeons = dataLoader.getAllDungeons();

  // Sort dungeons by requiredLevel (lowest first)
  const sortedDungeons = [...allDungeons].sort((a, b) => {
    const levelA = a.requiredLevel ?? 0;
    const levelB = b.requiredLevel ?? 0;
    return levelA - levelB;
  });

  return (
    <div className="dungeon-selector">
      <h2>{t('dungeon.selectDungeon')}</h2>
      {sortedDungeons.length === 0 ? (
        <div className="no-dungeons">{t('dungeon.noDungeonsAvailable')}</div>
      ) : (
        <>
          <div className="dungeon-list">
            {sortedDungeons.map((dungeon) => {
              const unlocked = isDungeonUnlocked(dungeon);
              const progress = getDungeonProgress(dungeon.id);
              const isSelected = selectedDungeonId === dungeon.id;

              return (
                <div
                  key={dungeon.id}
                  className={`dungeon-item ${isSelected ? 'active' : ''} ${!unlocked ? 'locked' : ''}`}
                  onClick={() => unlocked && handleDungeonSelect(dungeon.id)}
                >
                  <div className="dungeon-header">
                    <div className="dungeon-name">{dataLoader.getTranslatedName(dungeon)}</div>
                    {!unlocked && <div className="dungeon-locked-badge">{t('dungeon.locked')}</div>}
                  </div>
                  <div className="dungeon-info">
                    <div className="dungeon-tier">{t('dungeon.tier')} {dungeon.tier}</div>
                    {dungeon.requiredLevel && (
                      <div className="dungeon-requirement">{t('character.level')} {dungeon.requiredLevel}+</div>
                    )}
                  </div>
                  <div className="dungeon-description">{dataLoader.getTranslatedDescription(dungeon)}</div>
                  {progress && progress.completed && (
                    <div className="dungeon-stats">
                      {t('dungeon.completed')} {progress.timesCompleted} {t('dungeon.time')}
                      {progress.timesCompleted !== 1 ? 's' : ''}
                      {progress.bestTime && <div>{t('dungeon.bestTime')}: {progress.bestTime.toFixed(1)}s</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {selectedDungeonId &&
            isDungeonUnlocked(sortedDungeons.find((d) => d.id === selectedDungeonId)!) && (
              <button className="start-combat-button" onClick={handleStartCombat}>
                {t('combat.startCombat')}
              </button>
            )}
        </>
      )}
    </div>
  );
}

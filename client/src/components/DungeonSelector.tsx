import { useEffect, useState } from 'react';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { DungeonManager } from '../systems/dungeon';
import type { Dungeon } from '@idle-rpg/shared';
import './DungeonSelector.css';

export default function DungeonSelector() {
  const character = useGameState((state) => state.character);
  const dungeonProgress = useGameState((state) => state.dungeonProgress);
  const currentDungeonId = useGameState((state) => state.currentDungeonId);
  const setCurrentDungeon = useGameState((state) => state.setCurrentDungeon);
  const startCombat = useGameState((state) => state.startCombat);
  
  const [selectedDungeonId, setSelectedDungeonId] = useState<string | null>(currentDungeonId);

  // Note: availableDungeons was calculated but never used - component uses allDungeons directly

  useEffect(() => {
    setSelectedDungeonId(currentDungeonId);
  }, [currentDungeonId]);

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
        alert('Failed to start combat. Please try again.');
      }
    }
  };

  const getDungeonProgress = (dungeonId: string) => {
    return dungeonProgress.find(p => p.dungeonId === dungeonId);
  };

  const isDungeonUnlocked = (dungeon: Dungeon): boolean => {
    if (!character) return false;
    const progress = getDungeonProgress(dungeon.id);
    if (progress?.unlocked) return true;
    
    const completedDungeonIds = dungeonProgress.filter(p => p.completed).map(p => p.dungeonId);
    return DungeonManager.isDungeonUnlocked(dungeon, character.level, completedDungeonIds);
  };

  if (!character) {
    return null;
  }

  const dataLoader = getDataLoader();
  const allDungeons = dataLoader.getAllDungeons();

  return (
    <div className="dungeon-selector">
      <h2>Select Dungeon</h2>
      {allDungeons.length === 0 ? (
        <div className="no-dungeons">No dungeons available</div>
      ) : (
        <>
          <div className="dungeon-list">
            {allDungeons.map((dungeon) => {
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
                    <div className="dungeon-name">{dungeon.name}</div>
                    {!unlocked && <div className="dungeon-locked-badge">Locked</div>}
                  </div>
                  <div className="dungeon-info">
                    <div className="dungeon-tier">Tier {dungeon.tier}</div>
                    {dungeon.requiredLevel && (
                      <div className="dungeon-requirement">Level {dungeon.requiredLevel}+</div>
                    )}
                  </div>
                  <div className="dungeon-description">{dungeon.description}</div>
                  {progress && progress.completed && (
                    <div className="dungeon-stats">
                      Completed {progress.timesCompleted} time{progress.timesCompleted !== 1 ? 's' : ''}
                      {progress.bestTime && (
                        <div>Best Time: {progress.bestTime.toFixed(1)}s</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {selectedDungeonId && isDungeonUnlocked(allDungeons.find(d => d.id === selectedDungeonId)!) && (
            <button 
              className="start-combat-button"
              onClick={handleStartCombat}
            >
              Start Combat
            </button>
          )}
        </>
      )}
    </div>
  );
}

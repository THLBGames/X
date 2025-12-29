import { useState, useEffect } from 'react';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { QuestManager } from '../systems/quest/QuestManager';
import type { Quest, QuestProgress } from '@idle-rpg/shared';
import './QuestPanel.css';

export default function QuestPanel() {
  const character = useGameState((state) => state.character);
  const setCharacter = useGameState((state) => state.setCharacter);
  const [showCompleted, setShowCompleted] = useState(false);
  const dataLoader = getDataLoader();

  // Auto-initialize quest progress for all quests when panel is opened
  useEffect(() => {
    if (character) {
      const allQuests = dataLoader.getAllQuests();
      let updatedCharacter = character;
      let hasChanges = false;

      for (const quest of allQuests) {
        const existingProgress = QuestManager.getQuestProgress(character, quest.id);
        if (!existingProgress) {
          updatedCharacter = QuestManager.initializeQuestProgress(updatedCharacter, quest.id);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        setCharacter(updatedCharacter);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character?.id]); // Only re-run when character ID changes, not on every character update

  if (!character) {
    return null;
  }

  const allQuests = dataLoader.getAllQuests();
  const activeQuests: Array<{ quest: Quest; progress: QuestProgress }> = [];
  const completedQuests: Array<{ quest: Quest; progress: QuestProgress }> = [];

  for (const quest of allQuests) {
    const progress = QuestManager.getQuestProgress(character, quest.id);
    if (progress) {
      if (progress.completed) {
        completedQuests.push({ quest, progress });
      } else {
        activeQuests.push({ quest, progress });
      }
    }
  }

  const getQuestRequirementText = (quest: Quest): string => {
    if (quest.type === 'dungeon_completion' && quest.requirements.dungeonId) {
      const dungeon = dataLoader.getDungeon(quest.requirements.dungeonId);
      return `Complete: ${dungeon?.name || quest.requirements.dungeonId}`;
    } else if (quest.type === 'monster_kills' && quest.requirements.monsterId) {
      const monster = dataLoader.getMonster(quest.requirements.monsterId);
      return `Kill: ${monster?.name || quest.requirements.monsterId}`;
    } else if (quest.type === 'item_collection' && quest.requirements.itemId) {
      const item = dataLoader.getItem(quest.requirements.itemId);
      return `Collect: ${item?.name || quest.requirements.itemId}`;
    }
    return 'Unknown requirement';
  };

  const getQuestTypeLabel = (type: string): string => {
    switch (type) {
      case 'dungeon_completion':
        return 'Dungeon';
      case 'monster_kills':
        return 'Hunt';
      case 'item_collection':
        return 'Gather';
      default:
        return type;
    }
  };

  return (
    <div className="quest-panel">
      <h2>Quests</h2>

      {/* Active Quests Section */}
      <div className="quest-section">
        <h3 className="quest-section-title">Active Quests</h3>
        {activeQuests.length === 0 ? (
          <div className="no-quests">No active quests</div>
        ) : (
          <div className="quest-list">
            {activeQuests.map(({ quest, progress }) => {
              const progressPercent = (progress.progress / progress.required) * 100;

              return (
                <div key={quest.id} className="quest-card active">
                  <div className="quest-header">
                    <div className="quest-name">{quest.name}</div>
                    <div className={`quest-type-badge ${quest.type}`}>
                      {getQuestTypeLabel(quest.type)}
                    </div>
                  </div>
                  <div className="quest-description">{quest.description}</div>
                  <div className="quest-requirement">
                    {getQuestRequirementText(quest)}
                  </div>
                  <div className="quest-progress-container">
                    <div className="quest-progress-bar">
                      <div
                        className="quest-progress-fill"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="quest-progress-text">
                      {progress.progress} / {progress.required}
                    </div>
                  </div>
                  {quest.rewards && (
                    <div className="quest-rewards">
                      <div className="rewards-label">Rewards:</div>
                      <div className="rewards-list">
                        {quest.rewards.experience && (
                          <span className="reward-item">+{quest.rewards.experience} XP</span>
                        )}
                        {quest.rewards.gold && (
                          <span className="reward-item">+{quest.rewards.gold} Gold</span>
                        )}
                        {quest.rewards.items &&
                          quest.rewards.items.map((item, idx) => (
                            <span key={idx} className="reward-item">
                              {item.quantity}x {dataLoader.getItem(item.itemId)?.name || item.itemId}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Quests Section */}
      {completedQuests.length > 0 && (
        <div className="quest-section">
          <button
            className="quest-section-toggle"
            onClick={() => setShowCompleted(!showCompleted)}
          >
            <span className="toggle-icon">{showCompleted ? '▼' : '▶'}</span>
            <h3 className="quest-section-title">Completed Quests ({completedQuests.length})</h3>
          </button>
          {showCompleted && (
            <div className="quest-list">
              {completedQuests.map(({ quest, progress }) => (
                <div key={quest.id} className="quest-card completed">
                  <div className="quest-header">
                    <div className="quest-name">
                      <span className="completed-checkmark">✓</span> {quest.name}
                    </div>
                    <div className={`quest-type-badge ${quest.type} completed`}>
                      {getQuestTypeLabel(quest.type)}
                    </div>
                  </div>
                  <div className="quest-description">{quest.description}</div>
                  <div className="quest-completion-status">Completed</div>
                  {quest.rewards && (
                    <div className="quest-rewards">
                      <div className="rewards-label">Rewards Received:</div>
                      <div className="rewards-list">
                        {quest.rewards.experience && (
                          <span className="reward-item">+{quest.rewards.experience} XP</span>
                        )}
                        {quest.rewards.gold && (
                          <span className="reward-item">+{quest.rewards.gold} Gold</span>
                        )}
                        {quest.rewards.items &&
                          quest.rewards.items.map((item, idx) => (
                            <span key={idx} className="reward-item">
                              {item.quantity}x {dataLoader.getItem(item.itemId)?.name || item.itemId}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


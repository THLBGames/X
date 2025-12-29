import { useState, useEffect } from 'react';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { ClassChangeManager } from '../systems/character/ClassChangeManager';
import { QuestManager } from '../systems/quest/QuestManager';
import type { CharacterClass } from '@idle-rpg/shared';
import './ClassChangeModal.css';

interface ClassChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newClassId: string) => void;
}

export default function ClassChangeModal({ isOpen, onClose, onConfirm }: ClassChangeModalProps) {
  const character = useGameState((state) => state.character);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classes, setClasses] = useState<CharacterClass[]>([]);

  useEffect(() => {
    if (isOpen && character) {
      const dataLoader = getDataLoader();
      const allClasses = dataLoader.getAllClasses();
      setClasses(allClasses);
      // Don't pre-select current class
      setSelectedClassId(null);
    }
  }, [isOpen, character]);

  if (!isOpen || !character) {
    return null;
  }

  const dataLoader = getDataLoader();
  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const currentClass = classes.find((c) => c.id === character.classId);

  const handleConfirm = () => {
    if (selectedClassId && selectedClassId !== character.classId) {
      onConfirm(selectedClassId);
      onClose();
    }
  };

  const getStatDifference = (newClassId: string) => {
    if (!selectedClassId || selectedClassId === character.classId) {
      return null;
    }
    return ClassChangeManager.getStatDifference(character, newClassId);
  };

  const statDiff = selectedClassId ? getStatDifference(selectedClassId) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="class-change-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Change Class</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          <div className="current-class-info">
            <div className="current-class-label">Current Class:</div>
            <div className="current-class-name">{currentClass?.name || character.classId}</div>
          </div>

          <div className="class-selection-grid">
            {classes.map((characterClass) => {
              const isCurrent = characterClass.id === character.classId;
              const isSelected = selectedClassId === characterClass.id;
              const canChangeTo = ClassChangeManager.canChangeToClass(character, characterClass.id);
              const unlockLevel = characterClass.unlockLevel || 50;
              const levelMet = character.level >= unlockLevel;
              const quest = characterClass.requiredQuestId
                ? dataLoader.getQuest(characterClass.requiredQuestId)
                : null;
              const questCompleted = characterClass.requiredQuestId
                ? QuestManager.hasCompletedQuest(character, characterClass.requiredQuestId)
                : true;
              const questProgress = characterClass.requiredQuestId
                ? QuestManager.getQuestProgress(character, characterClass.requiredQuestId)
                : null;

              return (
                <div
                  key={characterClass.id}
                  className={`class-option ${isCurrent ? 'current' : ''} ${isSelected ? 'selected' : ''} ${!canChangeTo ? 'locked' : ''} class-${characterClass.id}`}
                  onClick={() => !isCurrent && canChangeTo && setSelectedClassId(characterClass.id)}
                >
                  <div className="class-option-header">
                    <h3>{characterClass.name}</h3>
                    {isCurrent && <span className="current-badge">Current</span>}
                    {!canChangeTo && !levelMet && (
                      <span className="locked-badge">Lv. {unlockLevel}</span>
                    )}
                    {!canChangeTo && levelMet && !questCompleted && quest && (
                      <span className="locked-badge">Quest Required</span>
                    )}
                  </div>
                  <p className="class-option-description">{characterClass.description}</p>
                  {quest && (
                    <div className="class-quest-info">
                      <div className="quest-label">Required Quest:</div>
                      <div className="quest-name">{quest.name}</div>
                      {questProgress && !questCompleted && (
                        <div className="quest-progress">
                          Progress: {questProgress.progress} / {questProgress.required}
                        </div>
                      )}
                      {questCompleted && <div className="quest-completed">✓ Quest Completed</div>}
                    </div>
                  )}
                  <div className="class-option-stats">
                    <div className="stat-compact">
                      <span>STR</span>
                      <span>{characterClass.baseStats.strength}</span>
                    </div>
                    <div className="stat-compact">
                      <span>DEX</span>
                      <span>{characterClass.baseStats.dexterity}</span>
                    </div>
                    <div className="stat-compact">
                      <span>INT</span>
                      <span>{characterClass.baseStats.intelligence}</span>
                    </div>
                    <div className="stat-compact">
                      <span>VIT</span>
                      <span>{characterClass.baseStats.vitality}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedClass && selectedClass.id !== character.classId && (
            <div className="stat-comparison">
              <h3>Stat Changes</h3>
              <div className="comparison-stats">
                {statDiff &&
                  Object.entries(statDiff.baseStats).map(([stat, diff]) => (
                    <div key={stat} className="stat-change">
                      <span className="stat-name">{stat}:</span>
                      <span className={`stat-diff ${diff > 0 ? 'positive' : 'negative'}`}>
                        {diff > 0 ? '+' : ''}
                        {diff}
                      </span>
                    </div>
                  ))}
                {(!statDiff || Object.keys(statDiff.baseStats).length === 0) && (
                  <div className="no-changes">No significant stat changes</div>
                )}
              </div>
              <div className="change-warning">
                <p>⚠️ Changing class will:</p>
                <ul>
                  <li>Reset your combat skills</li>
                  <li>Recalculate your stats</li>
                  <li>Unequip incompatible equipment</li>
                  <li>Preserve your level, experience, and idle skills</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="button-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button-confirm"
            onClick={handleConfirm}
            disabled={
              !selectedClassId ||
              selectedClassId === character.classId ||
              !ClassChangeManager.canChangeToClass(character, selectedClassId)
            }
          >
            Change Class
          </button>
        </div>
      </div>
    </div>
  );
}

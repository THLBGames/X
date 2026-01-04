import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['ui', 'common']);
  const character = useGameState((state) => state.character);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classes, setClasses] = useState<CharacterClass[]>([]);
  const dataLoader = getDataLoader();

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
          <h2>{t('buttons.changeClass')}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          <div className="current-class-info">
            <div className="current-class-label">{t('classChange.currentClass')}:</div>
            <div className="current-class-name">{currentClass ? dataLoader.getTranslatedName(currentClass) : character.classId}</div>
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
                    <h3>{dataLoader.getTranslatedName(characterClass)}</h3>
                    {isCurrent && <span className="current-badge">{t('classChange.current')}</span>}
                    {!canChangeTo && !levelMet && (
                      <span className="locked-badge">{t('character.level')} {unlockLevel}</span>
                    )}
                    {!canChangeTo && levelMet && !questCompleted && quest && (
                      <span className="locked-badge">{t('classChange.questRequired')}</span>
                    )}
                  </div>
                  <p className="class-option-description">{dataLoader.getTranslatedDescription(characterClass)}</p>
                  {quest && (
                    <div className="class-quest-info">
                      <div className="quest-label">{t('classChange.requiredQuest')}:</div>
                      <div className="quest-name">{dataLoader.getTranslatedName(quest)}</div>
                      {questProgress && !questCompleted && (
                        <div className="quest-progress">
                          {t('quest.progress')}: {questProgress.progress} / {questProgress.required}
                        </div>
                      )}
                      {questCompleted && <div className="quest-completed">✓ {t('quest.questCompleted')}</div>}
                    </div>
                  )}
                  <div className="class-option-stats">
                    <div className="stat-compact">
                      <span>{t('common.stats.strength', { ns: 'common' }).substring(0, 3).toUpperCase()}</span>
                      <span>{characterClass.baseStats.strength}</span>
                    </div>
                    <div className="stat-compact">
                      <span>{t('common.stats.dexterity', { ns: 'common' }).substring(0, 3).toUpperCase()}</span>
                      <span>{characterClass.baseStats.dexterity}</span>
                    </div>
                    <div className="stat-compact">
                      <span>{t('common.stats.intelligence', { ns: 'common' }).substring(0, 3).toUpperCase()}</span>
                      <span>{characterClass.baseStats.intelligence}</span>
                    </div>
                    <div className="stat-compact">
                      <span>{t('common.stats.vitality', { ns: 'common' }).substring(0, 3).toUpperCase()}</span>
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

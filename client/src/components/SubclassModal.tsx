import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { SubclassManager } from '../systems/character/SubclassManager';
import { QuestManager } from '../systems/quest/QuestManager';
import type { CharacterClass } from '@idle-rpg/shared';
import './SubclassModal.css';

interface SubclassModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SubclassModal({ isOpen, onClose }: SubclassModalProps) {
  const { t } = useTranslation(['ui', 'common']);
  const character = useGameState((state) => state.character);
  const setCharacter = useGameState((state) => state.setCharacter);
  const [subclasses, setSubclasses] = useState<CharacterClass[]>([]);
  const [selectedSubclassId, setSelectedSubclassId] = useState<string | null>(null);
  const dataLoader = getDataLoader();

  useEffect(() => {
    if (isOpen && character) {
      const availableSubclasses = SubclassManager.getAvailableSubclasses(character);
      setSubclasses(availableSubclasses);
      setSelectedSubclassId(character.subclassId || null);
    }
  }, [isOpen, character]);

  if (!isOpen || !character) {
    return null;
  }

  const baseClass = dataLoader.getClass(character.classId);
  const currentSubclass = character.subclassId ? dataLoader.getSubclass(character.subclassId) : null;

  const handleConfirm = () => {
    if (!character) return;

    try {
      const updatedCharacter = SubclassManager.changeSubclass(character, selectedSubclassId);
      setCharacter(updatedCharacter);
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : t('subclass.failedToChange'));
    }
  };

  const canSelectSubclass = (subclassId: string) => {
    return SubclassManager.canUnlockSubclass(character, subclassId);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="subclass-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('buttons.selectSubclass')}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          <div className="current-class-info">
            <div className="current-class-label">{t('subclass.baseClass')}:</div>
            <div className="current-class-name">{baseClass ? dataLoader.getTranslatedName(baseClass) : character.classId}</div>
            {currentSubclass && (
              <>
                <div className="current-class-label" style={{ marginTop: '8px' }}>{t('subclass.currentSubclass')}:</div>
                <div className="current-subclass-name">{dataLoader.getTranslatedName(currentSubclass)}</div>
              </>
            )}
          </div>

          <div className="subclass-info">
            <p>{t('subclass.unlockInfo')}</p>
            <p>{t('subclass.switchInfo')}</p>
          </div>

          <div className="subclass-selection-grid">
            {subclasses.map((subclass) => {
              const isCurrent = subclass.id === character.subclassId;
              const isSelected = selectedSubclassId === subclass.id;
              const canSelect = canSelectSubclass(subclass.id);
              const unlockLevel = subclass.unlockLevel || 50;
              const quest = subclass.requiredQuestId ? dataLoader.getQuest(subclass.requiredQuestId) : null;
              const questCompleted = subclass.requiredQuestId ? QuestManager.hasCompletedQuest(character, subclass.requiredQuestId) : true;
              const questProgress = subclass.requiredQuestId ? QuestManager.getQuestProgress(character, subclass.requiredQuestId) : null;
              const levelMet = character.level >= unlockLevel;

              return (
                <div
                  key={subclass.id}
                  className={`subclass-option ${isCurrent ? 'current' : ''} ${isSelected ? 'selected' : ''} ${!canSelect ? 'locked' : ''}`}
                  onClick={() => canSelect && setSelectedSubclassId(isSelected ? null : subclass.id)}
                >
                  <div className="subclass-header">
                    <div className="subclass-name">{dataLoader.getTranslatedName(subclass)}</div>
                    {isCurrent && <div className="current-badge">{t('subclass.current')}</div>}
                    {!canSelect && !levelMet && (
                      <div className="locked-badge">{t('character.level')} {unlockLevel}</div>
                    )}
                    {!canSelect && levelMet && !questCompleted && quest && (
                      <div className="locked-badge">{t('subclass.questRequired')}</div>
                    )}
                  </div>
                  <div className="subclass-description">{dataLoader.getTranslatedDescription(subclass)}</div>
                  {quest && (
                    <div className="subclass-quest-info">
                      <div className="quest-label">{t('subclass.requiredQuest')}:</div>
                      <div className="quest-name">{dataLoader.getTranslatedName(quest)}</div>
                      {questProgress && !questCompleted && (
                        <div className="quest-progress">
                          {t('quest.progress')}: {questProgress.progress} / {questProgress.required}
                        </div>
                      )}
                      {questCompleted && (
                        <div className="quest-completed">✓ {t('quest.questCompleted')}</div>
                      )}
                    </div>
                  )}
                  <div className="subclass-stats">
                    <div className="stat-label">{t('subclass.statGrowthFocus')}:</div>
                    <div className="stat-growth-preview">
                      {Object.entries(subclass.statGrowth)
                        .filter(([_, value]) => value > 2)
                        .map(([stat, value]) => (
                          <span key={stat} className="stat-growth-item">
                            {t(`common.stats.${stat}`, { ns: 'common' })}: +{value.toFixed(1)}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {subclasses.length === 0 && (
            <div className="no-subclasses">
              {t('subclass.noSubclassesAvailable')} {baseClass ? dataLoader.getTranslatedName(baseClass) : character.classId}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="button-cancel" onClick={onClose}>
            {t('buttons.cancel')}
          </button>
          <button
            className="button-confirm"
            onClick={handleConfirm}
            disabled={selectedSubclassId === (character.subclassId || null)}
          >
            {selectedSubclassId === null ? t('subclass.removeSubclass') : t('buttons.changeSubclass')}
          </button>
        </div>
      </div>
    </div>
  );
}


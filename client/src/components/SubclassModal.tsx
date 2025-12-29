import { useState, useEffect } from 'react';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { SubclassManager } from '../systems/character/SubclassManager';
import type { CharacterClass } from '@idle-rpg/shared';
import './SubclassModal.css';

interface SubclassModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SubclassModal({ isOpen, onClose }: SubclassModalProps) {
  const character = useGameState((state) => state.character);
  const setCharacter = useGameState((state) => state.setCharacter);
  const [subclasses, setSubclasses] = useState<CharacterClass[]>([]);
  const [selectedSubclassId, setSelectedSubclassId] = useState<string | null>(null);

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

  const dataLoader = getDataLoader();
  const baseClass = dataLoader.getClass(character.classId);
  const currentSubclass = character.subclassId ? dataLoader.getSubclass(character.subclassId) : null;

  const handleConfirm = () => {
    if (!character) return;

    try {
      const updatedCharacter = SubclassManager.changeSubclass(character, selectedSubclassId);
      setCharacter(updatedCharacter);
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to change subclass');
    }
  };

  const canSelectSubclass = (subclassId: string) => {
    return SubclassManager.canUnlockSubclass(character, subclassId);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="subclass-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Select Subclass</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          <div className="current-class-info">
            <div className="current-class-label">Base Class:</div>
            <div className="current-class-name">{baseClass?.name || character.classId}</div>
            {currentSubclass && (
              <>
                <div className="current-class-label" style={{ marginTop: '8px' }}>Current Subclass:</div>
                <div className="current-subclass-name">{currentSubclass.name}</div>
              </>
            )}
          </div>

          <div className="subclass-info">
            <p>Subclasses unlock at level 50 and allow you to specialize your class.</p>
            <p>You can switch between unlocked subclasses freely.</p>
          </div>

          <div className="subclass-selection-grid">
            {subclasses.map((subclass) => {
              const isCurrent = subclass.id === character.subclassId;
              const isSelected = selectedSubclassId === subclass.id;
              const canSelect = canSelectSubclass(subclass.id);
              const unlockLevel = subclass.unlockLevel || 50;

              return (
                <div
                  key={subclass.id}
                  className={`subclass-option ${isCurrent ? 'current' : ''} ${isSelected ? 'selected' : ''} ${!canSelect ? 'locked' : ''}`}
                  onClick={() => canSelect && setSelectedSubclassId(isSelected ? null : subclass.id)}
                >
                  <div className="subclass-header">
                    <div className="subclass-name">{subclass.name}</div>
                    {isCurrent && <div className="current-badge">Current</div>}
                    {!canSelect && character.level < unlockLevel && (
                      <div className="locked-badge">Lv. {unlockLevel}</div>
                    )}
                  </div>
                  <div className="subclass-description">{subclass.description}</div>
                  <div className="subclass-stats">
                    <div className="stat-label">Stat Growth Focus:</div>
                    <div className="stat-growth-preview">
                      {Object.entries(subclass.statGrowth)
                        .filter(([_, value]) => value > 2)
                        .map(([stat, value]) => (
                          <span key={stat} className="stat-growth-item">
                            {stat.charAt(0).toUpperCase() + stat.slice(1)}: +{value.toFixed(1)}
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
              No subclasses available for {baseClass?.name || character.classId}
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
            disabled={selectedSubclassId === (character.subclassId || null)}
          >
            {selectedSubclassId === null ? 'Remove Subclass' : 'Change Subclass'}
          </button>
        </div>
      </div>
    </div>
  );
}


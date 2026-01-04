import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { CharacterManager } from '../systems/character';
import { getSaveManager } from '../systems/save';
import type { CharacterClass } from '@idle-rpg/shared';
import './CharacterCreation.css';

export default function CharacterCreation() {
  const { t } = useTranslation(['ui', 'common']);
  const [classes, setClasses] = useState<CharacterClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [characterName, setCharacterName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const setCharacter = useGameState((state) => state.setCharacter);
  //const setDungeonProgress = useGameState((state) => state.setDungeonProgress);
  const unlockDungeon = useGameState((state) => state.unlockDungeon);
  const inventory = useGameState((state) => state.inventory);
  const settings = useGameState((state) => state.settings);

  useEffect(() => {
    // Load available base classes only (not subclasses)
    const dataLoader = getDataLoader();
    const availableClasses = dataLoader.getBaseClasses();
    setClasses(availableClasses);
    
    // Select first class by default
    if (availableClasses.length > 0) {
      setSelectedClassId(availableClasses[0].id);
    }
  }, []);

  const handleCreateCharacter = async () => {
    setError(null);

    // Validation
    if (!selectedClassId) {
      setError(t('validation.selectClass'));
      return;
    }

    const trimmedName = characterName.trim();
    if (!trimmedName) {
      setError(t('validation.enterCharacterName'));
      return;
    }

    if (trimmedName.length < 2) {
      setError(t('validation.characterNameMinLength'));
      return;
    }

    if (trimmedName.length > 20) {
      setError(t('validation.characterNameMaxLength'));
      return;
    }

    setIsCreating(true);

    try {
      // Create character
      const character = CharacterManager.createCharacter(selectedClassId, trimmedName);
      
      // Set character in game state
      setCharacter(character);

      // Unlock beginner dungeon (forest_clearing) for level 1 characters
      const dataLoader = getDataLoader();
      const { DungeonManager } = await import('../systems/dungeon');
      const allDungeons = dataLoader.getAllDungeons();
      const completedDungeonIds: string[] = []; // New character has no completed dungeons
      
      // Find and unlock all dungeons that should be unlocked at level 1
      for (const dungeon of allDungeons) {
        if (DungeonManager.isDungeonUnlocked(dungeon, character.level, completedDungeonIds)) {
          unlockDungeon(dungeon.id);
        }
      }

      // Create initial save
      const saveManager = getSaveManager();
      await saveManager.initialize();
      
      const currentDungeonProgress = useGameState.getState().dungeonProgress;
      const saveData = {
        version: '1.0.0',
        character,
        inventory,
        dungeonProgress: currentDungeonProgress,
        settings,
        lastSaved: Date.now(),
      };

      await saveManager.save(saveData);
    } catch (err) {
      console.error('Character creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create character. Please try again.');
      setIsCreating(false);
    }
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const [showComparison, setShowComparison] = useState(false);
  const dataLoader = getDataLoader();

  return (
    <div className="character-creation">
      <div className="character-creation-container">
        <div className="game-branding">
          <h2 className="game-title-branding">Tales of Heroes, Legends & Beasts</h2>
        </div>
        <h1>{t('character.createCharacter')}</h1>
        
        <div className="character-creation-form">
          {/* Character Name Input */}
          <div className="form-group">
            <label htmlFor="character-name">{t('character.characterName')}</label>
            <input
              id="character-name"
              type="text"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              placeholder={t('character.enterCharacterName')}
              maxLength={20}
              disabled={isCreating}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isCreating && selectedClassId && characterName.trim()) {
                  handleCreateCharacter();
                }
              }}
            />
          </div>

          {/* Class Selection */}
          <div className="form-group">
            <div className="class-selection-header">
              <label>{t('character.selectClass')}</label>
              {classes.length > 1 && (
                <button
                  className="comparison-toggle"
                  onClick={() => setShowComparison(!showComparison)}
                  type="button"
                >
                  {showComparison ? t('character.hideComparison') : t('character.compareClasses')}
                </button>
              )}
            </div>
            {showComparison && classes.length > 1 ? (
              <div className="class-comparison-view">
                <div className="comparison-table">
                  <div className="comparison-header">
                    <div className="comparison-class-col">{t('character.class')}</div>
                    <div className="comparison-stat-col">{t('common.stats.strength', { ns: 'common' }).substring(0, 3).toUpperCase()}</div>
                    <div className="comparison-stat-col">{t('common.stats.dexterity', { ns: 'common' }).substring(0, 3).toUpperCase()}</div>
                    <div className="comparison-stat-col">{t('common.stats.intelligence', { ns: 'common' }).substring(0, 3).toUpperCase()}</div>
                    <div className="comparison-stat-col">{t('common.stats.vitality', { ns: 'common' }).substring(0, 3).toUpperCase()}</div>
                    <div className="comparison-stat-col">{t('common.stats.wisdom', { ns: 'common' }).substring(0, 3).toUpperCase()}</div>
                    <div className="comparison-stat-col">{t('common.stats.luck', { ns: 'common' }).substring(0, 3).toUpperCase()}</div>
                  </div>
                  {classes.map((characterClass) => (
                    <div
                      key={characterClass.id}
                      className={`comparison-row ${selectedClassId === characterClass.id ? 'selected' : ''}`}
                      onClick={() => !isCreating && setSelectedClassId(characterClass.id)}
                    >
                      <div className="comparison-class-col">
                        <div className="class-name-compact">{dataLoader.getTranslatedName(characterClass)}</div>
                      </div>
                      <div className="comparison-stat-col">{characterClass.baseStats.strength}</div>
                      <div className="comparison-stat-col">{characterClass.baseStats.dexterity}</div>
                      <div className="comparison-stat-col">{characterClass.baseStats.intelligence}</div>
                      <div className="comparison-stat-col">{characterClass.baseStats.vitality}</div>
                      <div className="comparison-stat-col">{characterClass.baseStats.wisdom}</div>
                      <div className="comparison-stat-col">{characterClass.baseStats.luck}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="class-selection">
                {classes.map((characterClass) => (
                  <div
                    key={characterClass.id}
                    className={`class-card ${selectedClassId === characterClass.id ? 'selected' : ''} class-${characterClass.id}`}
                    onClick={() => !isCreating && setSelectedClassId(characterClass.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (!isCreating) setSelectedClassId(characterClass.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Select ${characterClass.name} class`}
                  >
                    <div className="class-card-header">
                      <h3 className="class-name">{dataLoader.getTranslatedName(characterClass)}</h3>
                      {selectedClassId === characterClass.id && (
                        <div className="selected-indicator">✓</div>
                      )}
                    </div>
                    <p className="class-description">{dataLoader.getTranslatedDescription(characterClass)}</p>
                    <div className="class-stats-preview">
                      <div className="stat-preview">
                        <span>{t('common.stats.strength', { ns: 'common' })}:</span>
                        <span className="stat-value">{characterClass.baseStats.strength}</span>
                        <span className="stat-growth">(+{characterClass.statGrowth.strength}/lvl)</span>
                      </div>
                      <div className="stat-preview">
                        <span>{t('common.stats.dexterity', { ns: 'common' })}:</span>
                        <span className="stat-value">{characterClass.baseStats.dexterity}</span>
                        <span className="stat-growth">(+{characterClass.statGrowth.dexterity}/lvl)</span>
                      </div>
                      <div className="stat-preview">
                        <span>{t('common.stats.intelligence', { ns: 'common' })}:</span>
                        <span className="stat-value">{characterClass.baseStats.intelligence}</span>
                        <span className="stat-growth">(+{characterClass.statGrowth.intelligence}/lvl)</span>
                      </div>
                      <div className="stat-preview">
                        <span>{t('common.stats.vitality', { ns: 'common' })}:</span>
                        <span className="stat-value">{characterClass.baseStats.vitality}</span>
                        <span className="stat-growth">(+{characterClass.statGrowth.vitality}/lvl)</span>
                      </div>
                      <div className="stat-preview">
                        <span>{t('common.stats.wisdom', { ns: 'common' })}:</span>
                        <span className="stat-value">{characterClass.baseStats.wisdom}</span>
                        <span className="stat-growth">(+{characterClass.statGrowth.wisdom}/lvl)</span>
                      </div>
                      <div className="stat-preview">
                        <span>{t('common.stats.luck', { ns: 'common' })}:</span>
                        <span className="stat-value">{characterClass.baseStats.luck}</span>
                        <span className="stat-growth">(+{characterClass.statGrowth.luck}/lvl)</span>
                      </div>
                    </div>
                    <div className="class-meta">
                      <div className="meta-item">
                        <span className="meta-label">{t('character.skills')}:</span>
                        <span className="meta-value">{characterClass.availableSkills.length}</span>
                      </div>
                      {characterClass.equipmentRestrictions && (
                        <div className="meta-item">
                          <span className="meta-label">{t('character.weapons')}:</span>
                          <span className="meta-value">
                            {characterClass.equipmentRestrictions.weaponTypes?.join(', ') || t('character.all')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Class Summary */}
          {selectedClass && (
            <div className="selected-class-summary">
              <h3>{t('character.selected')}: {dataLoader.getTranslatedName(selectedClass)}</h3>
              <p>{dataLoader.getTranslatedDescription(selectedClass)}</p>
            </div>
          )}

          {/* Error Message */}
          {error && <div className="error-message">{error}</div>}

          {/* Create Button */}
          <button
            className="create-character-button"
            onClick={handleCreateCharacter}
            disabled={isCreating || !selectedClassId || !characterName.trim()}
          >
            {isCreating ? t('character.creating') : t('character.createButton')}
          </button>
        </div>
      </div>
    </div>
  );
}


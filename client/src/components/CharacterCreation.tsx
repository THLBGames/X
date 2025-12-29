import { useState, useEffect } from 'react';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { CharacterManager } from '../systems/character';
import { getSaveManager } from '../systems/save';
import type { CharacterClass } from '@idle-rpg/shared';
import './CharacterCreation.css';

export default function CharacterCreation() {
  const [classes, setClasses] = useState<CharacterClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [characterName, setCharacterName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const setCharacter = useGameState((state) => state.setCharacter);
  const setDungeonProgress = useGameState((state) => state.setDungeonProgress);
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
      setError('Please select a character class');
      return;
    }

    const trimmedName = characterName.trim();
    if (!trimmedName) {
      setError('Please enter a character name');
      return;
    }

    if (trimmedName.length < 2) {
      setError('Character name must be at least 2 characters');
      return;
    }

    if (trimmedName.length > 20) {
      setError('Character name must be 20 characters or less');
      return;
    }

    setIsCreating(true);

    try {
      // Create character
      const character = CharacterManager.createCharacter(selectedClassId, trimmedName);
      
      // Set character in game state
      setCharacter(character);

      // Unlock first dungeon
      const dataLoader = getDataLoader();
      const allDungeons = dataLoader.getAllDungeons();
      if (allDungeons.length > 0) {
        const firstDungeon = allDungeons[0];
        setDungeonProgress([
          {
            dungeonId: firstDungeon.id,
            completed: false,
            timesCompleted: 0,
            unlocked: true,
          },
        ]);
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

  return (
    <div className="character-creation">
      <div className="character-creation-container">
        <h1>Create Your Character</h1>
        
        <div className="character-creation-form">
          {/* Character Name Input */}
          <div className="form-group">
            <label htmlFor="character-name">Character Name</label>
            <input
              id="character-name"
              type="text"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              placeholder="Enter your character's name"
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
              <label>Select Class</label>
              {classes.length > 1 && (
                <button
                  className="comparison-toggle"
                  onClick={() => setShowComparison(!showComparison)}
                  type="button"
                >
                  {showComparison ? 'Hide Comparison' : 'Compare Classes'}
                </button>
              )}
            </div>
            {showComparison && classes.length > 1 ? (
              <div className="class-comparison-view">
                <div className="comparison-table">
                  <div className="comparison-header">
                    <div className="comparison-class-col">Class</div>
                    <div className="comparison-stat-col">STR</div>
                    <div className="comparison-stat-col">DEX</div>
                    <div className="comparison-stat-col">INT</div>
                    <div className="comparison-stat-col">VIT</div>
                    <div className="comparison-stat-col">WIS</div>
                    <div className="comparison-stat-col">LCK</div>
                  </div>
                  {classes.map((characterClass) => (
                    <div
                      key={characterClass.id}
                      className={`comparison-row ${selectedClassId === characterClass.id ? 'selected' : ''}`}
                      onClick={() => !isCreating && setSelectedClassId(characterClass.id)}
                    >
                      <div className="comparison-class-col">
                        <div className="class-name-compact">{characterClass.name}</div>
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
                      <h3 className="class-name">{characterClass.name}</h3>
                      {selectedClassId === characterClass.id && (
                        <div className="selected-indicator">✓</div>
                      )}
                    </div>
                    <p className="class-description">{characterClass.description}</p>
                    <div className="class-stats-preview">
                      <div className="stat-preview">
                        <span>Strength:</span>
                        <span className="stat-value">{characterClass.baseStats.strength}</span>
                        <span className="stat-growth">(+{characterClass.statGrowth.strength}/lvl)</span>
                      </div>
                      <div className="stat-preview">
                        <span>Dexterity:</span>
                        <span className="stat-value">{characterClass.baseStats.dexterity}</span>
                        <span className="stat-growth">(+{characterClass.statGrowth.dexterity}/lvl)</span>
                      </div>
                      <div className="stat-preview">
                        <span>Intelligence:</span>
                        <span className="stat-value">{characterClass.baseStats.intelligence}</span>
                        <span className="stat-growth">(+{characterClass.statGrowth.intelligence}/lvl)</span>
                      </div>
                      <div className="stat-preview">
                        <span>Vitality:</span>
                        <span className="stat-value">{characterClass.baseStats.vitality}</span>
                        <span className="stat-growth">(+{characterClass.statGrowth.vitality}/lvl)</span>
                      </div>
                      <div className="stat-preview">
                        <span>Wisdom:</span>
                        <span className="stat-value">{characterClass.baseStats.wisdom}</span>
                        <span className="stat-growth">(+{characterClass.statGrowth.wisdom}/lvl)</span>
                      </div>
                      <div className="stat-preview">
                        <span>Luck:</span>
                        <span className="stat-value">{characterClass.baseStats.luck}</span>
                        <span className="stat-growth">(+{characterClass.statGrowth.luck}/lvl)</span>
                      </div>
                    </div>
                    <div className="class-meta">
                      <div className="meta-item">
                        <span className="meta-label">Skills:</span>
                        <span className="meta-value">{characterClass.availableSkills.length}</span>
                      </div>
                      {characterClass.equipmentRestrictions && (
                        <div className="meta-item">
                          <span className="meta-label">Weapons:</span>
                          <span className="meta-value">
                            {characterClass.equipmentRestrictions.weaponTypes?.join(', ') || 'All'}
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
              <h3>Selected: {selectedClass.name}</h3>
              <p>{selectedClass.description}</p>
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
            {isCreating ? 'Creating...' : 'Create Character'}
          </button>
        </div>
      </div>
    </div>
  );
}


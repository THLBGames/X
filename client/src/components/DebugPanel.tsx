import { useState } from 'react';
import { useGameState } from '../systems';
import { CharacterManager } from '../systems/character/CharacterManager';
import { InventoryManager } from '../systems/inventory';
import { IdleSkillSystem } from '../systems/skills/IdleSkillSystem';
import { SkillManager } from '../systems/skills/SkillManager';
import { getDataLoader } from '../data';
import type { Stats } from '@idle-rpg/shared';
import './DebugPanel.css';

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DebugPanel({ isOpen, onClose }: DebugPanelProps) {
  const character = useGameState((state) => state.character);
  const inventory = useGameState((state) => state.inventory);
  const setCharacter = useGameState((state) => state.setCharacter);
  const setInventory = useGameState((state) => state.setInventory);
  const setDungeonProgress = useGameState((state) => state.setDungeonProgress);
  const updateIdleSkill = useGameState((state) => state.updateIdleSkill);

  const [activeTab, setActiveTab] = useState<'character' | 'stats' | 'items' | 'skills' | 'progress'>('character');

  // Character tab inputs
  const [levelInput, setLevelInput] = useState('');
  const [expInput, setExpInput] = useState('');
  const [expToNextInput, setExpToNextInput] = useState('');
  const [skillPointsInput, setSkillPointsInput] = useState('');

  // Stats tab inputs
  const [strengthInput, setStrengthInput] = useState('');
  const [dexterityInput, setDexterityInput] = useState('');
  const [intelligenceInput, setIntelligenceInput] = useState('');
  const [vitalityInput, setVitalityInput] = useState('');
  const [wisdomInput, setWisdomInput] = useState('');
  const [luckInput, setLuckInput] = useState('');

  // Items tab inputs
  const [itemIdInput, setItemIdInput] = useState('');
  const [itemQuantityInput, setItemQuantityInput] = useState('1');
  const [goldInput, setGoldInput] = useState('');

  // Skills tab inputs
  const [skillIdInput, setSkillIdInput] = useState('');
  const [skillLevelInput, setSkillLevelInput] = useState('1');
  const [idleSkillIdInput, setIdleSkillIdInput] = useState('');
  const [idleSkillLevelInput, setIdleSkillLevelInput] = useState('1');

  if (!isOpen || !character) {
    return null;
  }

  const dataLoader = getDataLoader();

  // Character tab functions
  const handleSetLevel = () => {
    const level = parseInt(levelInput, 10);
    if (isNaN(level) || level < 1 || level > 99) {
      alert('Level must be between 1 and 99');
      return;
    }

    // Recalculate stats for new level
    const classData = dataLoader.getClass(character.classId);
    if (!classData) {
      alert('Class data not found');
      return;
    }

    const newBaseStats: Stats = {
      strength: classData.baseStats.strength + (level - 1) * classData.statGrowth.strength,
      dexterity: classData.baseStats.dexterity + (level - 1) * classData.statGrowth.dexterity,
      intelligence: classData.baseStats.intelligence + (level - 1) * classData.statGrowth.intelligence,
      vitality: classData.baseStats.vitality + (level - 1) * classData.statGrowth.vitality,
      wisdom: classData.baseStats.wisdom + (level - 1) * classData.statGrowth.wisdom,
      luck: classData.baseStats.luck + (level - 1) * classData.statGrowth.luck,
    };

    // Round stats
    Object.keys(newBaseStats).forEach((key) => {
      const k = key as keyof Stats;
      newBaseStats[k] = Math.floor(newBaseStats[k]);
    });

    const experienceToNext = CharacterManager.getExperienceForNextLevel(level);
    const currentExp = character.experience;

    const updatedCharacter = {
      ...character,
      level,
      baseStats: newBaseStats,
      currentStats: newBaseStats,
      experienceToNext,
      experience: Math.min(currentExp, experienceToNext - 1), // Cap exp to not exceed next level
    };

    const finalCharacter = CharacterManager.updateCharacterStats(updatedCharacter);
    setCharacter(finalCharacter);
    setLevelInput('');
    alert(`Level set to ${level}`);
  };

  const handleSetExperience = () => {
    const exp = parseInt(expInput, 10);
    if (isNaN(exp) || exp < 0) {
      alert('Experience must be a positive number');
      return;
    }

    const updatedCharacter = {
      ...character,
      experience: Math.min(exp, character.experienceToNext - 1),
    };
    setCharacter(updatedCharacter);
    setExpInput('');
    alert(`Experience set to ${exp}`);
  };

  const handleSetExperienceToNext = () => {
    const expToNext = parseInt(expToNextInput, 10);
    if (isNaN(expToNext) || expToNext < 1) {
      alert('Experience to next must be a positive number');
      return;
    }

    const updatedCharacter = {
      ...character,
      experienceToNext: expToNext,
    };
    setCharacter(updatedCharacter);
    setExpToNextInput('');
    alert(`Experience to next set to ${expToNext}`);
  };

  const handleSetSkillPoints = () => {
    const skillPoints = parseInt(skillPointsInput, 10);
    if (isNaN(skillPoints) || skillPoints < 0) {
      alert('Skill points must be a positive number');
      return;
    }

    const updatedCharacter = {
      ...character,
      skillPoints,
    };
    setCharacter(updatedCharacter);
    setSkillPointsInput('');
    alert(`Skill points set to ${skillPoints}`);
  };

  const handleRecalculateStats = () => {
    const updatedCharacter = CharacterManager.updateCharacterStats(character);
    setCharacter(updatedCharacter);
    alert('Stats recalculated');
  };

  // Stats tab functions
  const handleSetStat = (statName: keyof Stats, value: string) => {
    const statValue = parseInt(value, 10);
    if (isNaN(statValue) || statValue < 0) {
      alert(`${statName} must be a positive number`);
      return;
    }

    const newBaseStats = {
      ...character.baseStats,
      [statName]: statValue,
    };

    const updatedCharacter = {
      ...character,
      baseStats: newBaseStats,
      currentStats: newBaseStats,
    };

    const finalCharacter = CharacterManager.updateCharacterStats(updatedCharacter);
    setCharacter(finalCharacter);
    alert(`${statName} set to ${statValue}`);
  };

  // Items tab functions
  const handleGrantItem = async () => {
    const itemId = itemIdInput.trim();
    const quantity = parseInt(itemQuantityInput, 10);

    if (!itemId) {
      alert('Item ID is required');
      return;
    }

    if (isNaN(quantity) || quantity < 1) {
      alert('Quantity must be at least 1');
      return;
    }

    // Load item on-demand if not in cache
    let item = dataLoader.getItem(itemId);
    if (!item) {
      const loadedItem = await dataLoader.loadItem(itemId);
      if (!loadedItem) {
        alert(`Item not found: ${itemId}`);
        return;
      }
      item = loadedItem;
    }

    try {
      const newInventory = InventoryManager.addItem(inventory, itemId, quantity);
      setInventory(newInventory);
      setItemIdInput('');
      setItemQuantityInput('1');
      alert(`Granted ${quantity}x ${item.name}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to grant item');
    }
  };

  const handleSetGold = () => {
    const gold = parseInt(goldInput, 10);
    if (isNaN(gold) || gold < 0) {
      alert('Gold must be a positive number');
      return;
    }

    const currentGold = InventoryManager.getGold(inventory);
    const difference = gold - currentGold;

    let newInventory = inventory;
    if (difference > 0) {
      newInventory = InventoryManager.addGold(inventory, difference);
    } else if (difference < 0) {
      newInventory = InventoryManager.removeGold(inventory, Math.abs(difference));
    }

    setInventory(newInventory);
    setGoldInput('');
    alert(`Gold set to ${gold}`);
  };

  const handleClearInventory = () => {
    if (!confirm('Are you sure you want to clear all items from inventory? This cannot be undone.')) {
      return;
    }

    const gold = InventoryManager.getGold(inventory);
    let newInventory = {
      items: [] as Array<{ itemId: string; quantity: number }>,
      maxSlots: inventory.maxSlots,
    };

    // Restore gold
    if (gold > 0) {
      newInventory = InventoryManager.addGold(newInventory, gold);
    }

    setInventory(newInventory);
    alert('Inventory cleared');
  };

  // Skills tab functions
  const handleGrantSkill = () => {
    const skillId = skillIdInput.trim();
    const level = parseInt(skillLevelInput, 10);

    if (!skillId) {
      alert('Skill ID is required');
      return;
    }

    if (isNaN(level) || level < 1) {
      alert('Skill level must be at least 1');
      return;
    }

    const skill = dataLoader.getSkill(skillId);
    if (!skill) {
      alert(`Skill not found: ${skillId}`);
      return;
    }

    const result = SkillManager.learnSkill(character, skillId, level);
    if (result.success && result.character) {
      setCharacter(result.character);
      setSkillIdInput('');
      setSkillLevelInput('1');
      alert(`Granted ${skill.name} at level ${level}`);
    } else {
      alert(result.reason || 'Failed to grant skill');
    }
  };

  const handleRemoveSkill = () => {
    const skillId = skillIdInput.trim();
    if (!skillId) {
      alert('Skill ID is required');
      return;
    }

    const learnedSkills = character.learnedSkills.filter((ls) => ls.skillId !== skillId);
    const updatedCharacter = {
      ...character,
      learnedSkills,
    };
    setCharacter(updatedCharacter);
    setSkillIdInput('');
    alert(`Removed skill: ${skillId}`);
  };

  const handleSetIdleSkillLevel = () => {
    const skillId = idleSkillIdInput.trim();
    const level = parseInt(idleSkillLevelInput, 10);

    if (!skillId) {
      alert('Idle skill ID is required');
      return;
    }

    if (isNaN(level) || level < 1 || level > 99) {
      alert('Idle skill level must be between 1 and 99');
      return;
    }

    const skill = dataLoader.getSkill(skillId);
    if (!skill) {
      alert(`Skill not found: ${skillId}`);
      return;
    }

    // Calculate total experience for this level
    const baseExp = 100;
    const totalExp = IdleSkillSystem.calculateTotalExperienceForLevel(level, baseExp);
    const totalExpForNext = IdleSkillSystem.calculateTotalExperienceForLevel(level + 1, baseExp);
    const expToNext = totalExpForNext - totalExp;

    updateIdleSkill(skillId, {
      level,
      experience: totalExp,
      experienceToNext: expToNext,
    });

    setIdleSkillIdInput('');
    setIdleSkillLevelInput('1');
    alert(`Idle skill ${skillId} set to level ${level}`);
  };

  // Progress tab functions
  const handleUnlockAllDungeons = () => {
    const allDungeons = dataLoader.getAllDungeons();
    const dungeonProgress = allDungeons.map((dungeon) => ({
      dungeonId: dungeon.id,
      unlocked: true,
      completed: false,
      timesCompleted: 0,
    }));

    setDungeonProgress(dungeonProgress);
    alert(`Unlocked all ${allDungeons.length} dungeons`);
  };

  const handleResetDungeonProgress = () => {
    if (!confirm('Are you sure you want to reset all dungeon progress? This cannot be undone.')) {
      return;
    }

    setDungeonProgress([]);
    alert('Dungeon progress reset');
  };

  const handleResetCharacter = () => {
    if (!confirm('Are you sure you want to reset your character? This will reset level, XP, skills, and inventory. This cannot be undone.')) {
      return;
    }

    // Reset to level 1
    const classData = dataLoader.getClass(character.classId);
    if (!classData) {
      alert('Class data not found');
      return;
    }

    const resetCharacter = {
      ...character,
      level: 1,
      experience: 0,
      experienceToNext: CharacterManager.getExperienceForNextLevel(1),
      skillPoints: 0,
      baseStats: { ...classData.baseStats },
      currentStats: { ...classData.baseStats },
      learnedSkills: [],
      idleSkills: IdleSkillSystem.initializeIdleSkills(),
      skillBar: [],
    };

    const finalCharacter = CharacterManager.updateCharacterStats(resetCharacter);
    setCharacter(finalCharacter);

    // Clear inventory (keep gold if desired, or clear everything)
    const gold = InventoryManager.getGold(inventory);
    let resetInventory = {
      items: [] as Array<{ itemId: string; quantity: number }>,
      maxSlots: inventory.maxSlots,
    };
    if (gold > 0) {
      resetInventory = InventoryManager.addGold(resetInventory, gold);
    }
    setInventory(resetInventory);

    // Reset dungeon progress
    setDungeonProgress([]);

    alert('Character reset to level 1');
  };

  return (
    <div className="debug-panel-overlay" onClick={onClose}>
      <div className="debug-panel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="debug-panel-header">
          <h2>Debug Panel</h2>
          <button className="debug-panel-close" onClick={onClose}>×</button>
        </div>

        <div className="debug-panel-tabs">
          <button
            className={`debug-tab ${activeTab === 'character' ? 'active' : ''}`}
            onClick={() => setActiveTab('character')}
          >
            Character
          </button>
          <button
            className={`debug-tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            Stats
          </button>
          <button
            className={`debug-tab ${activeTab === 'items' ? 'active' : ''}`}
            onClick={() => setActiveTab('items')}
          >
            Items
          </button>
          <button
            className={`debug-tab ${activeTab === 'skills' ? 'active' : ''}`}
            onClick={() => setActiveTab('skills')}
          >
            Skills
          </button>
          <button
            className={`debug-tab ${activeTab === 'progress' ? 'active' : ''}`}
            onClick={() => setActiveTab('progress')}
          >
            Progress
          </button>
        </div>

        <div className="debug-panel-content">
          {/* Character Tab */}
          {activeTab === 'character' && (
            <div className="debug-tab-content">
              <div className="debug-section">
                <h3>Level</h3>
                <div className="debug-input-group">
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={levelInput}
                    onChange={(e) => setLevelInput(e.target.value)}
                    placeholder={`Current: ${character.level}`}
                  />
                  <button onClick={handleSetLevel}>Set Level</button>
                </div>
              </div>

              <div className="debug-section">
                <h3>Experience</h3>
                <div className="debug-input-group">
                  <input
                    type="number"
                    min="0"
                    value={expInput}
                    onChange={(e) => setExpInput(e.target.value)}
                    placeholder={`Current: ${character.experience}`}
                  />
                  <button onClick={handleSetExperience}>Set XP</button>
                </div>
              </div>

              <div className="debug-section">
                <h3>Experience to Next</h3>
                <div className="debug-input-group">
                  <input
                    type="number"
                    min="1"
                    value={expToNextInput}
                    onChange={(e) => setExpToNextInput(e.target.value)}
                    placeholder={`Current: ${character.experienceToNext}`}
                  />
                  <button onClick={handleSetExperienceToNext}>Set</button>
                </div>
              </div>

              <div className="debug-section">
                <h3>Skill Points</h3>
                <div className="debug-input-group">
                  <input
                    type="number"
                    min="0"
                    value={skillPointsInput}
                    onChange={(e) => setSkillPointsInput(e.target.value)}
                    placeholder={`Current: ${character.skillPoints}`}
                  />
                  <button onClick={handleSetSkillPoints}>Set</button>
                </div>
              </div>

              <div className="debug-section">
                <button className="debug-button-secondary" onClick={handleRecalculateStats}>
                  Recalculate Stats
                </button>
              </div>
            </div>
          )}

          {/* Stats Tab */}
          {activeTab === 'stats' && (
            <div className="debug-tab-content">
              <div className="debug-section">
                <h3>Base Stats</h3>
                <div className="debug-stats-grid">
                  <div className="debug-stat-item">
                    <label>Strength</label>
                    <div className="debug-input-group">
                      <input
                        type="number"
                        min="0"
                        value={strengthInput}
                        onChange={(e) => setStrengthInput(e.target.value)}
                        placeholder={`Current: ${character.baseStats.strength}`}
                      />
                      <button onClick={() => handleSetStat('strength', strengthInput)}>Set</button>
                    </div>
                  </div>

                  <div className="debug-stat-item">
                    <label>Dexterity</label>
                    <div className="debug-input-group">
                      <input
                        type="number"
                        min="0"
                        value={dexterityInput}
                        onChange={(e) => setDexterityInput(e.target.value)}
                        placeholder={`Current: ${character.baseStats.dexterity}`}
                      />
                      <button onClick={() => handleSetStat('dexterity', dexterityInput)}>Set</button>
                    </div>
                  </div>

                  <div className="debug-stat-item">
                    <label>Intelligence</label>
                    <div className="debug-input-group">
                      <input
                        type="number"
                        min="0"
                        value={intelligenceInput}
                        onChange={(e) => setIntelligenceInput(e.target.value)}
                        placeholder={`Current: ${character.baseStats.intelligence}`}
                      />
                      <button onClick={() => handleSetStat('intelligence', intelligenceInput)}>Set</button>
                    </div>
                  </div>

                  <div className="debug-stat-item">
                    <label>Vitality</label>
                    <div className="debug-input-group">
                      <input
                        type="number"
                        min="0"
                        value={vitalityInput}
                        onChange={(e) => setVitalityInput(e.target.value)}
                        placeholder={`Current: ${character.baseStats.vitality}`}
                      />
                      <button onClick={() => handleSetStat('vitality', vitalityInput)}>Set</button>
                    </div>
                  </div>

                  <div className="debug-stat-item">
                    <label>Wisdom</label>
                    <div className="debug-input-group">
                      <input
                        type="number"
                        min="0"
                        value={wisdomInput}
                        onChange={(e) => setWisdomInput(e.target.value)}
                        placeholder={`Current: ${character.baseStats.wisdom}`}
                      />
                      <button onClick={() => handleSetStat('wisdom', wisdomInput)}>Set</button>
                    </div>
                  </div>

                  <div className="debug-stat-item">
                    <label>Luck</label>
                    <div className="debug-input-group">
                      <input
                        type="number"
                        min="0"
                        value={luckInput}
                        onChange={(e) => setLuckInput(e.target.value)}
                        placeholder={`Current: ${character.baseStats.luck}`}
                      />
                      <button onClick={() => handleSetStat('luck', luckInput)}>Set</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Items Tab */}
          {activeTab === 'items' && (
            <div className="debug-tab-content">
              <div className="debug-section">
                <h3>Grant Item</h3>
                <div className="debug-input-group">
                  <input
                    type="text"
                    value={itemIdInput}
                    onChange={(e) => setItemIdInput(e.target.value)}
                    placeholder="Item ID"
                  />
                  <input
                    type="number"
                    min="1"
                    value={itemQuantityInput}
                    onChange={(e) => setItemQuantityInput(e.target.value)}
                    placeholder="Quantity"
                    style={{ width: '100px' }}
                  />
                  <button onClick={handleGrantItem}>Grant Item</button>
                </div>
              </div>

              <div className="debug-section">
                <h3>Gold</h3>
                <div className="debug-input-group">
                  <input
                    type="number"
                    min="0"
                    value={goldInput}
                    onChange={(e) => setGoldInput(e.target.value)}
                    placeholder={`Current: ${InventoryManager.getGold(inventory).toLocaleString()}`}
                  />
                  <button onClick={handleSetGold}>Set Gold</button>
                </div>
              </div>

              <div className="debug-section">
                <button className="debug-button-danger" onClick={handleClearInventory}>
                  Clear Inventory
                </button>
              </div>
            </div>
          )}

          {/* Skills Tab */}
          {activeTab === 'skills' && (
            <div className="debug-tab-content">
              <div className="debug-section">
                <h3>Combat Skills</h3>
                <div className="debug-input-group">
                  <input
                    type="text"
                    value={skillIdInput}
                    onChange={(e) => setSkillIdInput(e.target.value)}
                    placeholder="Skill ID"
                  />
                  <input
                    type="number"
                    min="1"
                    value={skillLevelInput}
                    onChange={(e) => setSkillLevelInput(e.target.value)}
                    placeholder="Level"
                    style={{ width: '100px' }}
                  />
                  <button onClick={handleGrantSkill}>Grant Skill</button>
                  <button className="debug-button-danger" onClick={handleRemoveSkill}>Remove Skill</button>
                </div>
              </div>

              <div className="debug-section">
                <h3>Idle Skills</h3>
                <div className="debug-input-group">
                  <input
                    type="text"
                    value={idleSkillIdInput}
                    onChange={(e) => setIdleSkillIdInput(e.target.value)}
                    placeholder="Idle Skill ID"
                  />
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={idleSkillLevelInput}
                    onChange={(e) => setIdleSkillLevelInput(e.target.value)}
                    placeholder="Level"
                    style={{ width: '100px' }}
                  />
                  <button onClick={handleSetIdleSkillLevel}>Set Level</button>
                </div>
              </div>
            </div>
          )}

          {/* Progress Tab */}
          {activeTab === 'progress' && (
            <div className="debug-tab-content">
              <div className="debug-section">
                <h3>Dungeons</h3>
                <div className="debug-button-group">
                  <button className="debug-button-secondary" onClick={handleUnlockAllDungeons}>
                    Unlock All Dungeons
                  </button>
                  <button className="debug-button-danger" onClick={handleResetDungeonProgress}>
                    Reset Dungeon Progress
                  </button>
                </div>
              </div>

              <div className="debug-section">
                <h3>Full Reset</h3>
                <button className="debug-button-danger" onClick={handleResetCharacter}>
                  Reset Character
                </button>
                <p className="debug-warning">This will reset level, XP, skills, and inventory.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


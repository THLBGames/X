import { useState } from 'react';
import { useGameState } from '../systems';
import { InventoryManager } from '../systems/inventory';
import { ClassChangeManager } from '../systems/character/ClassChangeManager';
import { getDataLoader } from '../data';
import ClassChangeModal from './ClassChangeModal';
import SkillTreeModal from './SkillTreeModal';
import SubclassModal from './SubclassModal';
import EquipmentPanel from './EquipmentPanel';
import './CharacterSheet.css';

export default function CharacterSheet() {
  const character = useGameState((state) => state.character);
  const inventory = useGameState((state) => state.inventory);
  const setCharacter = useGameState((state) => state.setCharacter);
  const setInventory = useGameState((state) => state.setInventory);
  const activeAction = useGameState((state) => state.activeAction);
  const maxOfflineHours = useGameState((state) => state.maxOfflineHours);
  const [showClassChange, setShowClassChange] = useState(false);
  const [showSkillTree, setShowSkillTree] = useState(false);
  const [showSubclass, setShowSubclass] = useState(false);

  if (!character) {
    return null;
  }

  const gold = InventoryManager.getGold(inventory);
  const dataLoader = getDataLoader();

  const getActiveActionDisplay = () => {
    if (!activeAction) return null;
    
    if (activeAction.type === 'combat') {
      const dungeon = dataLoader.getDungeon(activeAction.dungeonId);
      return `Combat: ${dungeon?.name || activeAction.dungeonId}`;
    } else if (activeAction.type === 'skill') {
      const skill = dataLoader.getSkill(activeAction.skillId);
      return `Training: ${skill?.name || activeAction.skillId}`;
    }
    return null;
  };

  const handleClassChange = (newClassId: string) => {
    try {
      const result = ClassChangeManager.changeClass(character, newClassId);
      if (result.success) {
        setCharacter(result.character);
        if (result.unequippedItems.length > 0) {
          // Add unequipped items to inventory
          let newInventory = inventory;
          for (const itemId of result.unequippedItems) {
            newInventory = InventoryManager.addItem(newInventory, itemId, 1);
          }
          setInventory(newInventory);
        }
        alert(result.message);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to change class');
    }
  };

  return (
    <>
      <div className="character-sheet">
        <h2>Character</h2>
      <div className="character-info">
        <div className="character-name">{character.name}</div>
        <div className="character-level">Level {character.level}</div>
        <div className="character-class">
          Class: {character.classId}
          {character.subclassId && (
            <>
              <br />
              <span className="character-subclass">Subclass: {character.subclassId}</span>
            </>
          )}
        </div>
        <div className="character-gold">Gold: {gold.toLocaleString()}</div>
        <div className="character-offline-hours">
          Max Offline Time: {maxOfflineHours} hours
        </div>
        {activeAction && (
          <div className="character-active-action">
            Active: {getActiveActionDisplay()}
          </div>
        )}
        <button
          className="change-class-button"
          onClick={() => setShowClassChange(true)}
        >
          Change Class
        </button>
        {character.level >= 50 && (
          <button
            className="change-subclass-button"
            onClick={() => setShowSubclass(true)}
          >
            {character.subclassId ? 'Change Subclass' : 'Select Subclass'}
          </button>
        )}
      </div>
      <div className="character-stats">
        <h3>Stats</h3>
        <div className="stat-row">
          <span>Strength:</span>
          <span>{character.currentStats.strength}</span>
        </div>
        <div className="stat-row">
          <span>Dexterity:</span>
          <span>{character.currentStats.dexterity}</span>
        </div>
        <div className="stat-row">
          <span>Intelligence:</span>
          <span>{character.currentStats.intelligence}</span>
        </div>
        <div className="stat-row">
          <span>Vitality:</span>
          <span>{character.currentStats.vitality}</span>
        </div>
        <div className="stat-row">
          <span>Wisdom:</span>
          <span>{character.currentStats.wisdom}</span>
        </div>
        <div className="stat-row">
          <span>Luck:</span>
          <span>{character.currentStats.luck}</span>
        </div>
      </div>
      <div className="character-combat-stats">
        <h3>Combat Stats</h3>
        <div className="stat-row">
          <span>Health:</span>
          <span>
            {character.combatStats.health} / {character.combatStats.maxHealth}
          </span>
        </div>
        <div className="stat-row">
          <span>Mana:</span>
          <span>
            {character.combatStats.mana} / {character.combatStats.maxMana}
          </span>
        </div>
        <div className="stat-row">
          <span>Attack:</span>
          <span>{character.combatStats.attack}</span>
        </div>
        <div className="stat-row">
          <span>Defense:</span>
          <span>{character.combatStats.defense}</span>
        </div>
      </div>
      <div className="character-experience">
        <div className="exp-bar-label">
          Experience: {character.experience} / {character.experienceToNext}
        </div>
        <div className="exp-bar">
          <div
            className="exp-bar-fill"
            style={{
              width: `${(character.experience / character.experienceToNext) * 100}%`,
            }}
          />
        </div>
      </div>
      <div className="character-skill-points">
        Skill Points: {character.skillPoints}
        <button
          className="open-skill-tree-button"
          onClick={() => setShowSkillTree(true)}
        >
          Open Skill Tree
        </button>
      </div>
      <EquipmentPanel />
      </div>
      <ClassChangeModal
        isOpen={showClassChange}
        onClose={() => setShowClassChange(false)}
        onConfirm={handleClassChange}
      />
      <SkillTreeModal
        isOpen={showSkillTree}
        onClose={() => setShowSkillTree(false)}
      />
      <SubclassModal
        isOpen={showSubclass}
        onClose={() => setShowSubclass(false)}
      />
    </>
  );
}


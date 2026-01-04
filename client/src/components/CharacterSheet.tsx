import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['ui', 'common']);
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
      const dungeonName = dungeon ? dataLoader.getTranslatedName(dungeon) : activeAction.dungeonId;
      return `${t('character.combat')}: ${dungeonName}`;
    } else if (activeAction.type === 'skill') {
      const skill = dataLoader.getSkill(activeAction.skillId);
      const skillName = skill ? dataLoader.getTranslatedName(skill) : activeAction.skillId;
      return `${t('character.training')}: ${skillName}`;
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
      alert(error instanceof Error ? error.message : t('character.failedToChangeClass'));
    }
  };

  return (
    <>
      <div className="character-sheet">
        <h2>{t('character.character')}</h2>
        <div className="character-info">
          <div className="character-name">{character.name}</div>
          <div className="character-level">{t('character.level')} {character.level}</div>
          <div className="character-class">
            {t('character.class')}: {character.classId}
            {character.subclassId && (
              <>
                <br />
                <span className="character-subclass">{t('character.subclass')}: {character.subclassId}</span>
              </>
            )}
          </div>
          <div className="character-gold">{t('character.gold')}: {gold.toLocaleString()}</div>
          <div className="character-offline-hours">{t('character.maxOfflineTime')}: {maxOfflineHours} {t('character.hours')}</div>
          {activeAction && (
            <div className="character-active-action">{getActiveActionDisplay()}</div>
          )}
          <button className="change-class-button" onClick={() => setShowClassChange(true)}>
            {t('buttons.changeClass')}
          </button>
          {character.level >= 50 && (
            <button className="change-subclass-button" onClick={() => setShowSubclass(true)}>
              {character.subclassId ? t('buttons.changeSubclass') : t('buttons.selectSubclass')}
            </button>
          )}
        </div>
        <div className="character-stats">
          <h3>{t('character.stats')}</h3>
          <div className="stat-row">
            <span>{t('stats.strength', { ns: 'common' })}:</span>
            <span>{character.currentStats.strength}</span>
          </div>
          <div className="stat-row">
            <span>{t('stats.dexterity', { ns: 'common' })}:</span>
            <span>{character.currentStats.dexterity}</span>
          </div>
          <div className="stat-row">
            <span>{t('stats.intelligence', { ns: 'common' })}:</span>
            <span>{character.currentStats.intelligence}</span>
          </div>
          <div className="stat-row">
            <span>{t('stats.vitality', { ns: 'common' })}:</span>
            <span>{character.currentStats.vitality}</span>
          </div>
          <div className="stat-row">
            <span>{t('stats.wisdom', { ns: 'common' })}:</span>
            <span>{character.currentStats.wisdom}</span>
          </div>
          <div className="stat-row">
            <span>{t('stats.luck', { ns: 'common' })}:</span>
            <span>{character.currentStats.luck}</span>
          </div>
        </div>
        <div className="character-combat-stats">
          <h3>{t('character.combatStats')}</h3>
          <div className="stat-row">
            <span>{t('combatStats.health', { ns: 'common' })}:</span>
            <span>
              {character.combatStats.health} / {character.combatStats.maxHealth}
            </span>
          </div>
          <div className="stat-row">
            <span>{t('combatStats.mana', { ns: 'common' })}:</span>
            <span>
              {character.combatStats.mana} / {character.combatStats.maxMana}
            </span>
          </div>
          <div className="stat-row">
            <span>{t('combatStats.attack', { ns: 'common' })}:</span>
            <span>{character.combatStats.attack}</span>
          </div>
          <div className="stat-row">
            <span>{t('combatStats.defense', { ns: 'common' })}:</span>
            <span>{character.combatStats.defense}</span>
          </div>
        </div>
        <div className="character-experience">
          <div className="exp-bar-label">
            {t('character.experience')}: {character.experience} / {character.experienceToNext}
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
          {t('character.skillPoints')}: {character.skillPoints}
          <button className="open-skill-tree-button" onClick={() => setShowSkillTree(true)}>
            {t('character.openSkillTree')}
          </button>
        </div>
        <EquipmentPanel />
      </div>
      <ClassChangeModal
        isOpen={showClassChange}
        onClose={() => setShowClassChange(false)}
        onConfirm={handleClassChange}
      />
      <SkillTreeModal isOpen={showSkillTree} onClose={() => setShowSkillTree(false)} />
      <SubclassModal isOpen={showSubclass} onClose={() => setShowSubclass(false)} />
    </>
  );
}

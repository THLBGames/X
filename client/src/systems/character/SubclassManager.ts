import type { Character, CharacterClass, Stats } from '@idle-rpg/shared';
import { getDataLoader } from '@/data';
import { CharacterManager } from './CharacterManager';
import { QuestManager } from '../quest/QuestManager';

export class SubclassManager {
  /**
   * Check if a character has completed a quest
   */
  static hasCompletedQuest(character: Character, questId: string): boolean {
    return QuestManager.hasCompletedQuest(character, questId);
  }

  /**
   * Check if a character can unlock a subclass
   */
  static canUnlockSubclass(character: Character, subclassId: string): boolean {
    const dataLoader = getDataLoader();
    const subclass = dataLoader.getSubclass(subclassId);
    
    if (!subclass) {
      return false;
    }

    // Check if it's actually a subclass
    if (!subclass.isSubclass) {
      return false;
    }

    // Check if character's class matches the parent class
    if (subclass.parentClass !== character.classId) {
      return false;
    }

    // Check level requirement
    const unlockLevel = subclass.unlockLevel || 50;
    if (character.level < unlockLevel) {
      return false;
    }

    // Check quest requirement
    if (subclass.requiredQuestId) {
      if (!this.hasCompletedQuest(character, subclass.requiredQuestId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Change character's subclass (or remove subclass by passing null)
   */
  static changeSubclass(character: Character, subclassId: string | null): Character {
    const dataLoader = getDataLoader();
    
    // If removing subclass, just set to undefined
    if (subclassId === null) {
      return {
        ...character,
        subclassId: undefined,
      };
    }

    // Validate subclass
    const subclass = dataLoader.getSubclass(subclassId);
    if (!subclass) {
      throw new Error(`Subclass not found: ${subclassId}`);
    }

    if (!this.canUnlockSubclass(character, subclassId)) {
      throw new Error(`Cannot unlock subclass ${subclassId}`);
    }

    // Update subclass ID
    const updatedCharacter: Character = {
      ...character,
      subclassId,
    };

    // Recalculate stats if subclass stat growth differs
    // Stats are recalculated based on base class + subclass stat growth
    // For now, we keep the current stats and let them be recalculated on next level up
    // If you want immediate stat recalculation, you would need to:
    // 1. Calculate what stats would be at current level with new subclass
    // 2. Adjust character's current stats accordingly
    // This is complex because it depends on how stats were accumulated over time

    return updatedCharacter;
  }

  /**
   * Get effective stat growth for a character (combines base class and subclass)
   */
  static getEffectiveStatGrowth(character: Character): Stats {
    const dataLoader = getDataLoader();
    const baseClass = dataLoader.getClass(character.classId);
    
    if (!baseClass) {
      throw new Error(`Class not found: ${character.classId}`);
    }

    // Start with base class stat growth
    let statGrowth = { ...baseClass.statGrowth };

    // If character has a subclass, combine stat growths
    // Subclass stat growth is added to base class stat growth
    if (character.subclassId) {
      const subclass = dataLoader.getSubclass(character.subclassId);
      if (subclass) {
        statGrowth = {
          strength: statGrowth.strength + subclass.statGrowth.strength,
          dexterity: statGrowth.dexterity + subclass.statGrowth.dexterity,
          intelligence: statGrowth.intelligence + subclass.statGrowth.intelligence,
          vitality: statGrowth.vitality + subclass.statGrowth.vitality,
          wisdom: statGrowth.wisdom + subclass.statGrowth.wisdom,
          luck: statGrowth.luck + subclass.statGrowth.luck,
        };
      }
    }

    return statGrowth;
  }

  /**
   * Get all available subclasses for a character's class
   */
  static getAvailableSubclasses(character: Character): CharacterClass[] {
    const dataLoader = getDataLoader();
    return dataLoader.getSubclassesForClass(character.classId);
  }
}


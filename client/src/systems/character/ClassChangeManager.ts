import type { Character, CharacterClass, Equipment } from '@idle-rpg/shared';
import { getDataLoader } from '@/data';
import { CharacterManager } from './CharacterManager';

export interface ClassChangeResult {
  success: boolean;
  character: Character;
  unequippedItems: string[]; // Item IDs that were unequipped
  message: string;
}

export class ClassChangeManager {
  /**
   * Change character's class
   * Preserves level, experience, idle skills
   * Recalculates stats, handles equipment, resets combat skills
   */
  static changeClass(
    character: Character,
    newClassId: string
  ): ClassChangeResult {
    const dataLoader = getDataLoader();
    const newClass = dataLoader.getClass(newClassId);

    if (!newClass) {
      throw new Error(`Class not found: ${newClassId}`);
    }

    if (character.classId === newClassId) {
      return {
        success: false,
        character,
        unequippedItems: [],
        message: 'Character is already this class',
      };
    }

    // Get old class for equipment restriction checking
    const oldClass = dataLoader.getClass(character.classId);
    if (!oldClass) {
      throw new Error(`Current class not found: ${character.classId}`);
    }

    // Handle equipment incompatibility
    const unequippedItems: string[] = [];
    const newEquipment: Equipment = { ...character.equipment };

    // Check each equipped item for compatibility with new class
    const equipmentSlots: Array<keyof Equipment> = [
      'weapon',
      'offhand',
      'helmet',
      'chest',
      'legs',
      'boots',
      'gloves',
      'accessory1',
      'accessory2',
    ];

    for (const slot of equipmentSlots) {
      const itemId = character.equipment[slot];
      if (!itemId) continue;

      const item = dataLoader.getItem(itemId);
      if (!item) continue;

      // Check if item has class restrictions that conflict with new class
      if (item.requirements?.class && !item.requirements.class.includes(newClassId)) {
        newEquipment[slot] = undefined;
        unequippedItems.push(itemId);
      }

      // Check equipment type restrictions (weapon types, armor types)
      if (item.equipmentSlot === 'weapon' && newClass.equipmentRestrictions?.weaponTypes) {
        // This is simplified - in a full implementation, you'd check item.type or similar
        // For now, we'll just check if the item has class restrictions
      }
    }

    // Recalculate base stats based on new class
    // Base stats = new class base stats + (level - 1) * stat growth
    const level = character.level;
    const newBaseStats = {
      strength:
        newClass.baseStats.strength + (level - 1) * newClass.statGrowth.strength,
      dexterity:
        newClass.baseStats.dexterity + (level - 1) * newClass.statGrowth.dexterity,
      intelligence:
        newClass.baseStats.intelligence +
        (level - 1) * newClass.statGrowth.intelligence,
      vitality:
        newClass.baseStats.vitality + (level - 1) * newClass.statGrowth.vitality,
      wisdom: newClass.baseStats.wisdom + (level - 1) * newClass.statGrowth.wisdom,
      luck: newClass.baseStats.luck + (level - 1) * newClass.statGrowth.luck,
    };

    // Round stats to integers
    Object.keys(newBaseStats).forEach((key) => {
      const k = key as keyof typeof newBaseStats;
      newBaseStats[k] = Math.floor(newBaseStats[k]);
    });

    // Recalculate combat stats (will be recalculated with equipment in CharacterManager)
    const newCombatStats = CharacterManager.calculateCombatStats(
      newBaseStats,
      newEquipment,
      character.statusEffects
    );

    // Reset learned combat skills (keep idle skills)
    const newLearnedSkills: Character['learnedSkills'] = [];

    // Create updated character
    const updatedCharacter: Character = {
      ...character,
      classId: newClassId,
      baseStats: newBaseStats,
      currentStats: { ...newBaseStats }, // Will be updated by equipment/buffs later
      combatStats: newCombatStats,
      equipment: newEquipment,
      learnedSkills: newLearnedSkills,
      skillBar: [], // Reset skill bar when changing class
      // Preserve level, experience, idle skills
    };

    return {
      success: true,
      character: updatedCharacter,
      unequippedItems,
      message: `Class changed to ${newClass.name}`,
    };
  }

  /**
   * Get stat difference when changing classes
   */
  static getStatDifference(
    character: Character,
    newClassId: string
  ): {
    baseStats: Partial<Record<keyof Character['baseStats'], number>>;
    combatStats: Partial<Record<keyof Character['combatStats'], number>>;
  } {
    const dataLoader = getDataLoader();
    const newClass = dataLoader.getClass(newClassId);

    if (!newClass) {
      return { baseStats: {}, combatStats: {} };
    }

    const level = character.level;
    const newBaseStats = {
      strength:
        newClass.baseStats.strength + (level - 1) * newClass.statGrowth.strength,
      dexterity:
        newClass.baseStats.dexterity + (level - 1) * newClass.statGrowth.dexterity,
      intelligence:
        newClass.baseStats.intelligence +
        (level - 1) * newClass.statGrowth.intelligence,
      vitality:
        newClass.baseStats.vitality + (level - 1) * newClass.statGrowth.vitality,
      wisdom: newClass.baseStats.wisdom + (level - 1) * newClass.statGrowth.wisdom,
      luck: newClass.baseStats.luck + (level - 1) * newClass.statGrowth.luck,
    };

    // Calculate differences
    const baseStatsDiff: Partial<Record<keyof Character['baseStats'], number>> = {};
    Object.keys(newBaseStats).forEach((key) => {
      const k = key as keyof typeof newBaseStats;
      const currentValue = character.baseStats[k];
      const newValue = Math.floor(newBaseStats[k]);
      if (currentValue !== newValue) {
        baseStatsDiff[k] = newValue - currentValue;
      }
    });

    // For combat stats, we'd need to recalculate, but for preview we'll estimate
    // This is a simplified version - in practice you'd want full recalculation
    const combatStatsDiff: Partial<Record<keyof Character['combatStats'], number>> = {};

    return {
      baseStats: baseStatsDiff,
      combatStats: combatStatsDiff,
    };
  }

  /**
   * Check if equipment is compatible with class
   */
  static isEquipmentCompatible(itemId: string, classId: string): boolean {
    const dataLoader = getDataLoader();
    const item = dataLoader.getItem(itemId);
    const characterClass = dataLoader.getClass(classId);

    if (!item || !characterClass) {
      return false;
    }

    // Check class restrictions
    if (item.requirements?.class && !item.requirements.class.includes(classId)) {
      return false;
    }

    // Check level requirements would be checked separately

    return true;
  }
}


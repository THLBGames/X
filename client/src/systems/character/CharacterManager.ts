import type {
  Character,
  CharacterClass,
  Stats,
  CombatStats,
  Equipment,
  LearnedSkill,
  ActiveStatusEffect,
} from '@idle-rpg/shared';
import { getDataLoader } from '@/data';
import { calculateExperienceForLevel } from '@/utils/experience';
import { IdleSkillSystem } from '../skills/IdleSkillSystem';

export class CharacterManager {
  /**
   * Create a new character with the specified class
   */
  static createCharacter(classId: string, name: string): Character {
    const dataLoader = getDataLoader();
    const characterClass = dataLoader.getClass(classId);

    if (!characterClass) {
      throw new Error(`Character class not found: ${classId}`);
    }

    const baseStats = { ...characterClass.baseStats };
    const combatStats = this.calculateCombatStats(baseStats, {}, []);

    return {
      id: `char_${Date.now()}`,
      name,
      classId,
      subclassId: undefined,
      level: 1,
      experience: 0,
      experienceToNext: this.getExperienceForNextLevel(1),
      skillPoints: 0,
      baseStats,
      currentStats: { ...baseStats },
      combatStats,
      learnedSkills: [],
      equipment: {},
      statusEffects: [],
      idleSkills: IdleSkillSystem.initializeIdleSkills(),
      skillBar: [], // Initialize empty skill bar
      activeMercenaries: [], // Initialize empty mercenaries array
      activeUpgrades: [], // Initialize empty upgrades array
      consumableUpgrades: [], // Initialize empty consumable upgrades array
      statistics: undefined, // Will be initialized when needed
      completedAchievements: [], // Initialize empty achievements array
    };
  }

  /**
   * Calculate combat stats from base stats, equipment, and status effects
   */
  static calculateCombatStats(
    baseStats: Stats,
    equipment: Equipment,
    statusEffects: Array<{
      statModifier?: Partial<Stats>;
      combatStatModifier?: Partial<CombatStats>;
    }>
  ): CombatStats {
    const dataLoader = getDataLoader();
    let stats = { ...baseStats };

    // Apply equipment stat bonuses
    const equipmentSlots: Array<keyof Equipment> = [
      'weapon',
      'offhand',
      'helmet',
      'chest',
      'legs',
      'boots',
      'gloves',
      'ring1',
      'ring2',
      'amulet',
    ];

    for (const slot of equipmentSlots) {
      const itemId = equipment[slot];
      if (itemId) {
        const item = dataLoader.getItem(itemId);
        if (item?.statBonuses) {
          // Apply stat bonuses from equipment
          Object.entries(item.statBonuses).forEach(([key, value]) => {
            const statKey = key as keyof Stats;
            if (value !== undefined) {
              stats[statKey] = (stats[statKey] || 0) + value;
            }
          });
        }
      }
    }

    // Apply status effect stat modifiers
    for (const effect of statusEffects) {
      if (effect.statModifier) {
        Object.entries(effect.statModifier).forEach(([key, value]) => {
          const statKey = key as keyof Stats;
          if (value !== undefined) {
            stats[statKey] = (stats[statKey] || 0) + value;
          }
        });
      }
    }

    // Calculate combat stats from base stats
    const combatStats: CombatStats = {
      health: 0,
      maxHealth: 0,
      mana: 0,
      maxMana: 0,
      attack: 0,
      defense: 0,
      magicAttack: 0,
      magicDefense: 0,
      speed: 0,
      criticalChance: 0,
      criticalDamage: 1.5,
    };

    // Health = 100 + (Vitality * 10)
    combatStats.maxHealth = 100 + stats.vitality * 10;
    combatStats.health = combatStats.maxHealth;

    // Mana = 50 + (Wisdom * 5) + (Intelligence * 3)
    combatStats.maxMana = 50 + stats.wisdom * 5 + stats.intelligence * 3;
    combatStats.mana = combatStats.maxMana;

    // Attack = Strength * 2 + Dexterity * 0.5
    combatStats.attack = stats.strength * 2 + stats.dexterity * 0.5;

    // Defense = Vitality * 1.5
    combatStats.defense = stats.vitality * 1.5;

    // Magic Attack = Intelligence * 2 + Wisdom * 0.5
    combatStats.magicAttack = stats.intelligence * 2 + stats.wisdom * 0.5;

    // Magic Defense = Wisdom * 1.5 + Intelligence * 0.5
    combatStats.magicDefense = stats.wisdom * 1.5 + stats.intelligence * 0.5;

    // Speed = Dexterity * 1.5
    combatStats.speed = stats.dexterity * 1.5;

    // Critical Chance = (Dexterity + Luck) * 0.1%
    combatStats.criticalChance = (stats.dexterity + stats.luck) * 0.1;

    // Apply equipment combat stat bonuses
    for (const slot of equipmentSlots) {
      const itemId = equipment[slot];
      if (itemId) {
        const item = dataLoader.getItem(itemId);
        if (item?.combatStatBonuses) {
          Object.entries(item.combatStatBonuses).forEach(([key, value]) => {
            const combatStatKey = key as keyof CombatStats;
            if (value !== undefined && combatStats[combatStatKey] !== undefined) {
              (combatStats[combatStatKey] as number) += value;
            }
          });
        }
      }
    }

    // Apply status effect combat stat modifiers
    for (const effect of statusEffects) {
      if (effect.combatStatModifier) {
        Object.entries(effect.combatStatModifier).forEach(([key, value]) => {
          const combatStatKey = key as keyof CombatStats;
          if (value !== undefined && combatStats[combatStatKey] !== undefined) {
            (combatStats[combatStatKey] as number) += value;
          }
        });
      }
    }

    return combatStats;
  }

  /**
   * Add experience to character and handle level ups
   */
  static addExperience(
    character: Character,
    experience: number
  ): {
    character: Character;
    leveledUp: boolean;
    levelsGained: number;
  } {
    const dataLoader = getDataLoader();
    // const config = dataLoader.getConfig();
    let newCharacter = { ...character };
    let leveledUp = false;
    let levelsGained = 0;
    let remainingExp = experience;

    while (remainingExp > 0) {
      const expNeeded = newCharacter.experienceToNext - newCharacter.experience;
      if (remainingExp >= expNeeded) {
        // Level up
        remainingExp -= expNeeded;
        newCharacter = this.levelUp(newCharacter);
        leveledUp = true;
        levelsGained++;
      } else {
        // Add remaining experience
        newCharacter.experience += remainingExp;
        remainingExp = 0;
      }
    }

    return { character: newCharacter, leveledUp, levelsGained };
  }

  /**
   * Level up the character
   */
  static levelUp(character: Character): Character {
    const dataLoader = getDataLoader();
    const characterClass = dataLoader.getClass(character.classId);

    if (!characterClass) {
      throw new Error(`Character class not found: ${character.classId}`);
    }

    const newLevel = character.level + 1;

    // Apply stat growth
    const newBaseStats: Stats = {
      strength: character.baseStats.strength + characterClass.statGrowth.strength,
      dexterity: character.baseStats.dexterity + characterClass.statGrowth.dexterity,
      intelligence: character.baseStats.intelligence + characterClass.statGrowth.intelligence,
      vitality: character.baseStats.vitality + characterClass.statGrowth.vitality,
      wisdom: character.baseStats.wisdom + characterClass.statGrowth.wisdom,
      luck: character.baseStats.luck + characterClass.statGrowth.luck,
    };

    // Recalculate combat stats with new base stats
    const newCombatStats = this.calculateCombatStats(
      newBaseStats,
      character.equipment,
      character.statusEffects.map((_se) => {
        // In a real implementation, you'd load the status effect definition
        return { statModifier: {}, combatStatModifier: {} };
      })
    );

    // Grant skill point (every level)
    const newSkillPoints = character.skillPoints + 1;

    return {
      ...character,
      level: newLevel,
      experience: 0,
      experienceToNext: this.getExperienceForNextLevel(newLevel),
      skillPoints: newSkillPoints,
      baseStats: newBaseStats,
      currentStats: { ...newBaseStats },
      combatStats: newCombatStats,
    };
  }

  /**
   * Get experience required for next level
   */
  static getExperienceForNextLevel(level: number): number {
    const dataLoader = getDataLoader();
    const config = dataLoader.getConfig();
    return calculateExperienceForLevel(
      level + 1,
      config.experience.baseExp,
      config.experience.expMultiplier
    );
  }

  /**
   * Calculate current stats (base stats + equipment bonuses + status effects)
   */
  static calculateCurrentStats(
    baseStats: Stats,
    equipment: Equipment,
    statusEffects: ActiveStatusEffect[]
  ): Stats {
    const dataLoader = getDataLoader();
    const stats = { ...baseStats };
    const equipmentSlots: Array<keyof Equipment> = [
      'weapon',
      'offhand',
      'helmet',
      'chest',
      'legs',
      'boots',
      'gloves',
      'ring1',
      'ring2',
      'amulet',
    ];

    // Apply equipment stat bonuses
    for (const slot of equipmentSlots) {
      const itemId = equipment[slot];
      if (itemId) {
        const item = dataLoader.getItem(itemId);
        if (item?.statBonuses) {
          Object.entries(item.statBonuses).forEach(([key, value]) => {
            const statKey = key as keyof Stats;
            if (value !== undefined) {
              stats[statKey] = (stats[statKey] || 0) + value;
            }
          });
        }
      }
    }

    // Apply status effect stat modifiers
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _effect of statusEffects) {
      // In a real implementation, you'd load the status effect definition
      // For now, status effects don't modify base stats directly
    }

    return stats;
  }

  /**
   * Update character's current stats based on equipment and status effects
   */
  static updateCharacterStats(character: Character): Character {
    // Calculate current stats (base stats + equipment bonuses)
    const currentStats = this.calculateCurrentStats(
      character.baseStats,
      character.equipment,
      character.statusEffects
    );

    // Calculate combat stats using current stats (which already include equipment stat bonuses)
    // Pass empty equipment to calculateCombatStats so it doesn't apply stat bonuses twice
    // but it still needs equipment to apply combat stat bonuses
    const dataLoader = getDataLoader();
    const equipmentSlots: Array<keyof Equipment> = [
      'weapon',
      'offhand',
      'helmet',
      'chest',
      'legs',
      'boots',
      'gloves',
      'ring1',
      'ring2',
      'amulet',
    ];

    const combatStats: CombatStats = {
      health: 0,
      maxHealth: 0,
      mana: 0,
      maxMana: 0,
      attack: 0,
      defense: 0,
      magicAttack: 0,
      magicDefense: 0,
      speed: 0,
      criticalChance: 0,
      criticalDamage: 1.5,
    };

    // Calculate combat stats from current stats (which already include equipment bonuses)
    combatStats.maxHealth = 100 + currentStats.vitality * 10;
    combatStats.health = combatStats.maxHealth;

    combatStats.maxMana = 50 + currentStats.wisdom * 5 + currentStats.intelligence * 3;
    combatStats.mana = combatStats.maxMana;

    combatStats.attack = currentStats.strength * 2 + currentStats.dexterity * 0.5;
    combatStats.defense = currentStats.vitality * 1.5;
    combatStats.magicAttack = currentStats.intelligence * 2 + currentStats.wisdom * 0.5;
    combatStats.magicDefense = currentStats.wisdom * 1.5 + currentStats.intelligence * 0.5;
    combatStats.speed = currentStats.dexterity * 1.5;
    combatStats.criticalChance = (currentStats.dexterity + currentStats.luck) * 0.1;

    // Apply equipment combat stat bonuses
    for (const slot of equipmentSlots) {
      const itemId = character.equipment[slot];
      if (itemId) {
        const item = dataLoader.getItem(itemId);
        if (item?.combatStatBonuses) {
          Object.entries(item.combatStatBonuses).forEach(([key, value]) => {
            const combatStatKey = key as keyof CombatStats;
            if (value !== undefined && combatStats[combatStatKey] !== undefined) {
              (combatStats[combatStatKey] as number) += value;
            }
          });
        }
      }
    }

    // Apply status effect combat stat modifiers
    for (const _effect of character.statusEffects) {
      // In a real implementation, you'd load the status effect definition
      // For now, status effects don't modify combat stats directly
    }

    return {
      ...character,
      currentStats,
      combatStats,
    };
  }

  /**
   * Learn a skill
   */
  static learnSkill(character: Character, skillId: string, level: number = 1): Character {
    const dataLoader = getDataLoader();
    const skill = dataLoader.getSkill(skillId);

    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    // Check if already learned
    const existingSkillIndex = character.learnedSkills.findIndex((ls) => ls.skillId === skillId);

    if (existingSkillIndex !== -1) {
      // Upgrade existing skill
      const updatedSkills = [...character.learnedSkills];
      updatedSkills[existingSkillIndex] = {
        skillId,
        level: Math.min(level, skill.maxLevel),
      };
      return {
        ...character,
        learnedSkills: updatedSkills,
      };
    } else {
      // Learn new skill
      return {
        ...character,
        learnedSkills: [
          ...character.learnedSkills,
          { skillId, level: Math.min(level, skill.maxLevel) },
        ],
      };
    }
  }

  /**
   * Equip an item
   */
  static equipItem(character: Character, itemId: string): Character {
    const dataLoader = getDataLoader();
    const item = dataLoader.getItem(itemId);

    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }

    if (!item.equipmentSlot) {
      throw new Error('Item is not equipment');
    }

    const newEquipment: Equipment = {
      ...character.equipment,
      [item.equipmentSlot]: itemId,
    };

    // Recalculate stats with new equipment
    const updatedCharacter = {
      ...character,
      equipment: newEquipment,
    };

    return this.updateCharacterStats(updatedCharacter);
  }

  /**
   * Unequip an item
   */
  static unequipItem(character: Character, slot: keyof Equipment): Character {
    const newEquipment = { ...character.equipment };
    delete newEquipment[slot];

    const updatedCharacter = {
      ...character,
      equipment: newEquipment,
    };

    return this.updateCharacterStats(updatedCharacter);
  }
}

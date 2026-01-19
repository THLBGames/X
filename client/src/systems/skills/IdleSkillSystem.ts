import type { Character, IdleSkillLevel, ResourceNode, Inventory } from '@idle-rpg/shared';
import { getDataLoader } from '@/data';
import { MercenaryManager } from '../mercenary/MercenaryManager';
import { UpgradeManager, type UpgradeBonuses } from '../upgrade/UpgradeManager';
import { InventoryManager } from '../inventory';

export class IdleSkillSystem {
  /**
   * Calculate experience needed for a skill level
   */
  static calculateExperienceForLevel(level: number, baseExp: number = 100): number {
    if (level <= 1) {
      return 0;
    }
    // Formula: baseExp * (level * 1.1) for gathering skills
    // For production skills, multiplier is higher (handled per skill)
    return Math.floor(baseExp * (level - 1) * 1.1);
  }

  /**
   * Calculate total experience needed to reach a level
   */
  static calculateTotalExperienceForLevel(level: number, baseExp: number = 100): number {
    let totalExp = 0;
    for (let i = 2; i <= level; i++) {
      totalExp += this.calculateExperienceForLevel(i, baseExp);
    }
    return totalExp;
  }

  /**
   * Get skill level from total experience
   */
  static getLevelFromExperience(totalExperience: number, baseExp: number = 100): number {
    let level = 1;
    let expNeeded = 0;
    while (expNeeded <= totalExperience) {
      level++;
      expNeeded += this.calculateExperienceForLevel(level, baseExp);
      if (expNeeded > totalExperience) {
        return level - 1;
      }
    }
    return Math.min(level, 99);
  }

  /**
   * Get skill level for character
   */
  static getSkillLevel(character: Character, skillId: string): number {
    if (!character.idleSkills) {
      return 0;
    }
    const skill = character.idleSkills.find((s) => s.skillId === skillId);
    return skill?.level || 0;
  }

  /**
   * Get skill experience for character
   */
  static getSkillExperience(character: Character, skillId: string): number {
    if (!character.idleSkills) {
      return 0;
    }
    const skill = character.idleSkills.find((s) => s.skillId === skillId);
    return skill?.experience || 0;
  }

  /**
   * Add experience to a skill
   */
  static addSkillExperience(
    character: Character,
    skillId: string,
    experience: number
  ): { character: Character; leveledUp: boolean; newLevel?: number } {
    const dataLoader = getDataLoader();
    const skill = dataLoader.getSkill(skillId);

    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    let idleSkills = character.idleSkills || [];
    let skillLevel = this.getSkillLevel(character, skillId);
    let skillExp = this.getSkillExperience(character, skillId);
    const previousLevel = skillLevel;

    // Add experience
    skillExp += experience;

    // Calculate new level
    const baseExp = skill.experienceFormula ? 100 : 100; // Default base exp
    const newLevel = Math.min(this.getLevelFromExperience(skillExp, baseExp), skill.maxLevel);

    // Calculate experience to next level
    // const totalExpForCurrent = this.calculateTotalExperienceForLevel(newLevel, baseExp);
    // const totalExpForNext = this.calculateTotalExperienceForLevel(newLevel + 1, baseExp);
    // const expToNext = totalExpForNext - skillExp;

    // Update or create skill entry
    const skillIndex = idleSkills.findIndex((s) => s.skillId === skillId);
    const skillData: IdleSkillLevel = {
      skillId,
      level: newLevel,
      experience: skillExp,
    };

    if (skillIndex !== -1) {
      idleSkills[skillIndex] = skillData;
    } else {
      idleSkills.push(skillData);
    }

    const leveledUp = newLevel > previousLevel;

    return {
      character: {
        ...character,
        idleSkills,
      },
      leveledUp,
      newLevel: leveledUp ? newLevel : undefined,
    };
  }

  /**
   * Get available resource nodes for a skill at current level
   * @param inventory Optional inventory to check for unlock requirements (for secret nodes)
   */
  static getAvailableResourceNodes(character: Character, skillId: string, inventory?: Inventory): ResourceNode[] {
    const dataLoader = getDataLoader();
    const skill = dataLoader.getSkill(skillId);

    if (!skill || !skill.resourceNodes) {
      return [];
    }

    const skillLevel = this.getSkillLevel(character, skillId);
    return skill.resourceNodes.filter((node) => {
      // Check level requirement
      if (skillLevel < node.level) {
        return false;
      }

      // Check unlock requirements if inventory is provided
      if (node.unlockRequirements && inventory) {
        for (const requirement of node.unlockRequirements) {
          const quantity = InventoryManager.getItemQuantity(inventory, requirement.itemId);
          if (quantity < requirement.quantity) {
            return false;
          }
        }
      } else if (node.unlockRequirements && !inventory) {
        // If node has unlock requirements but no inventory provided, hide it
        return false;
      }

      return true;
    });
  }

  /**
   * Get available recipes for a skill at current level
   * @param inventory Optional inventory to check for unlock requirements (for secret recipes)
   */
  static getAvailableRecipes(character: Character, skillId: string, inventory?: Inventory) {
    const dataLoader = getDataLoader();
    const skill = dataLoader.getSkill(skillId);

    if (!skill || !skill.recipes) {
      return [];
    }

    const skillLevel = this.getSkillLevel(character, skillId);
    return skill.recipes.filter((recipe) => {
      // Check level requirement
      if (skillLevel < recipe.level) {
        return false;
      }

      // Check unlock requirements if inventory is provided
      if (recipe.unlockRequirements && inventory) {
        for (const requirement of recipe.unlockRequirements) {
          const quantity = InventoryManager.getItemQuantity(inventory, requirement.itemId);
          if (quantity < requirement.quantity) {
            return false;
          }
        }
      } else if (recipe.unlockRequirements && !inventory) {
        // If recipe has unlock requirements but no inventory provided, hide it
        return false;
      }

      return true;
    });
  }

  /**
   * Get skilling mercenary bonuses
   */
  static getSkillingMercenaryBonuses(character: Character): {
    experienceMultiplier: number;
    speedMultiplier: number;
    yieldMultiplier: number;
  } {
    const skillingMercenaries = MercenaryManager.getSkillingMercenaries(character);
    let experienceMultiplier = 1;
    let speedMultiplier = 1;
    let yieldMultiplier = 1;

    for (const mercenary of skillingMercenaries) {
      if (mercenary.bonuses) {
        if (mercenary.bonuses.experienceMultiplier) {
          experienceMultiplier *= mercenary.bonuses.experienceMultiplier;
        }
        if (mercenary.bonuses.speedMultiplier) {
          speedMultiplier *= mercenary.bonuses.speedMultiplier;
        }
        if (mercenary.bonuses.yieldMultiplier) {
          yieldMultiplier *= mercenary.bonuses.yieldMultiplier;
        }
      }
    }

    return {
      experienceMultiplier,
      speedMultiplier,
      yieldMultiplier,
    };
  }

  /**
   * Get upgrade bonuses for a skill
   */
  static getUpgradeBonuses(character: Character, skillId: string): UpgradeBonuses {
    return UpgradeManager.getUpgradeBonuses(character, skillId);
  }

  /**
   * Get passive bonuses from all idle skills
   */
  static getPassiveBonuses(character: Character): {
    statBonus: Partial<Record<keyof import('@idle-rpg/shared').Stats, number>>;
    combatStatBonus: Partial<Record<keyof import('@idle-rpg/shared').CombatStats, number>>;
    goldGeneration: number;
    itemFindRate: number;
  } {
    const dataLoader = getDataLoader();
    const statBonus: Partial<Record<string, number>> = {};
    const combatStatBonus: Partial<Record<string, number>> = {};
    let goldGeneration = 0;
    let itemFindRate = 0;

    if (!character.idleSkills) {
      return {
        statBonus: {} as any,
        combatStatBonus: {} as any,
        goldGeneration: 0,
        itemFindRate: 0,
      };
    }

    for (const idleSkill of character.idleSkills) {
      const skill = dataLoader.getSkill(idleSkill.skillId);
      if (skill && skill.passiveBonuses) {
        // Find highest applicable bonus for current level
        for (const passiveBonus of skill.passiveBonuses) {
          if (idleSkill.level >= passiveBonus.level) {
            if (passiveBonus.bonus.statBonus) {
              Object.entries(passiveBonus.bonus.statBonus).forEach(([key, value]) => {
                statBonus[key] = (statBonus[key] || 0) + (value || 0);
              });
            }

            if (passiveBonus.bonus.combatStatBonus) {
              Object.entries(passiveBonus.bonus.combatStatBonus).forEach(([key, value]) => {
                combatStatBonus[key] = (combatStatBonus[key] || 0) + (value || 0);
              });
            }

            if (passiveBonus.bonus.goldGeneration !== undefined) {
              goldGeneration = Math.max(goldGeneration, passiveBonus.bonus.goldGeneration);
            }

            if (passiveBonus.bonus.itemFindRate !== undefined) {
              itemFindRate = Math.max(itemFindRate, passiveBonus.bonus.itemFindRate);
            }
          }
        }
      }
    }

    return {
      statBonus: statBonus as any,
      combatStatBonus: combatStatBonus as any,
      goldGeneration,
      itemFindRate,
    };
  }

  /**
   * Initialize idle skills for a new character (all start at level 1)
   */
  static initializeIdleSkills(): IdleSkillLevel[] {
    const skillIds = [
      'mining',
      'fishing',
      'woodcutting',
      'herbalism',
      'hunting',
      'archaeology',
      'quarrying',
      'foraging',
      'treasure_hunting',
      'thieving',
      'trapping',
      'divination',
      'cooking',
      'blacksmithing',
      'alchemy',
      'enchanting',
      'tailoring',
      'leatherworking',
      'jewelcrafting',
      'engineering',
      'runecrafting',
      'farming',
    ];

    // Calculate experience needed to go from level 1 to level 2
    const baseExp = 100;
    const expToLevel2 = this.calculateExperienceForLevel(2, baseExp);

    return skillIds.map((skillId) => ({
      skillId,
      level: 1,
      experience: 0,
      experienceToNext: expToLevel2,
    }));
  }
}

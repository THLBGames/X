import type { GameStatistics, Character } from '@idle-rpg/shared';
import { getDataLoader } from '@/data';
import { IdleSkillSystem } from '../skills/IdleSkillSystem';

export class StatisticsManager {
  /**
   * Initialize default statistics
   */
  static initializeStatistics(): GameStatistics {
    const now = Date.now();
    return {
      monsterKills: {},
      itemsCollected: {},
      skillActions: {},
      totalCombats: 0,
      totalCombatVictories: 0,
      totalCombatDefeats: 0,
      totalGoldEarned: 0,
      totalExperienceEarned: 0,
      totalSkillActions: 0,
      totalSkillExperience: 0,
      totalPlayTime: 0,
      firstPlayed: now,
      lastPlayed: now,
    };
  }

  /**
   * Record a monster kill
   */
  static recordMonsterKill(statistics: GameStatistics, monsterId: string): GameStatistics {
    // Validate monster ID - skip if empty or invalid
    if (!monsterId || monsterId.trim() === '') {
      console.warn(
        `[StatisticsManager] Attempted to record kill with invalid monster ID: "${monsterId}"`
      );
      return statistics;
    }

    // Clean up any existing empty string entries (legacy bug fix)
    const cleanedMonsterKills = { ...statistics.monsterKills };
    if (cleanedMonsterKills[''] !== undefined) {
      console.warn(
        `[StatisticsManager] Removing invalid empty string monster kill entry (count: ${cleanedMonsterKills['']})`
      );
      delete cleanedMonsterKills[''];
    }

    return {
      ...statistics,
      monsterKills: {
        ...cleanedMonsterKills,
        [monsterId]: (cleanedMonsterKills[monsterId] || 0) + 1,
      },
      lastPlayed: Date.now(),
    };
  }

  /**
   * Record item collection
   */
  static recordItemCollected(
    statistics: GameStatistics,
    itemId: string,
    quantity: number
  ): GameStatistics {
    return {
      ...statistics,
      itemsCollected: {
        ...statistics.itemsCollected,
        [itemId]: (statistics.itemsCollected[itemId] || 0) + quantity,
      },
      lastPlayed: Date.now(),
    };
  }

  /**
   * Record a skill action
   */
  static recordSkillAction(statistics: GameStatistics, skillId: string): GameStatistics {
    return {
      ...statistics,
      skillActions: {
        ...statistics.skillActions,
        [skillId]: (statistics.skillActions[skillId] || 0) + 1,
      },
      totalSkillActions: statistics.totalSkillActions + 1,
      lastPlayed: Date.now(),
    };
  }

  /**
   * Update combat statistics
   */
  static updateCombatStats(
    statistics: GameStatistics,
    victory: boolean,
    gold: number,
    experience: number
  ): GameStatistics {
    return {
      ...statistics,
      totalCombats: statistics.totalCombats + 1,
      totalCombatVictories: victory
        ? statistics.totalCombatVictories + 1
        : statistics.totalCombatVictories,
      totalCombatDefeats: victory
        ? statistics.totalCombatDefeats
        : statistics.totalCombatDefeats + 1,
      totalGoldEarned: statistics.totalGoldEarned + gold,
      totalExperienceEarned: statistics.totalExperienceEarned + experience,
      lastPlayed: Date.now(),
    };
  }

  /**
   * Update play time
   */
  static updatePlayTime(statistics: GameStatistics, deltaSeconds: number): GameStatistics {
    return {
      ...statistics,
      totalPlayTime: statistics.totalPlayTime + deltaSeconds,
      lastPlayed: Date.now(),
    };
  }

  /**
   * Get monster completion stats
   */
  static getMonsterCompletion(statistics: GameStatistics): {
    completed: number;
    total: number;
    percentage: number;
  } {
    const dataLoader = getDataLoader();
    const allMonsters = dataLoader.getAllMonsters();
    const uniqueMonstersKilled = Object.keys(statistics.monsterKills).length;
    const totalMonsters = allMonsters.length;

    return {
      completed: uniqueMonstersKilled,
      total: totalMonsters,
      percentage: totalMonsters > 0 ? (uniqueMonstersKilled / totalMonsters) * 100 : 0,
    };
  }

  /**
   * Get item completion stats
   */
  static getItemCompletion(statistics: GameStatistics): {
    completed: number;
    total: number;
    percentage: number;
  } {
    const dataLoader = getDataLoader();
    const allItems = dataLoader.getAllItems();
    // Filter out gold as it's not a collectible item
    const collectibleItems = allItems.filter((item) => item.id !== 'gold');
    const uniqueItemsCollected = Object.keys(statistics.itemsCollected).filter(
      (itemId) => itemId !== 'gold'
    ).length;
    const totalItems = collectibleItems.length;

    return {
      completed: uniqueItemsCollected,
      total: totalItems,
      percentage: totalItems > 0 ? (uniqueItemsCollected / totalItems) * 100 : 0,
    };
  }

  /**
   * Get skill completion stats
   */
  static getSkillCompletion(character: Character): {
    completed: number;
    total: number;
    percentage: number;
  } {
    const dataLoader = getDataLoader();
    const allSkills = dataLoader.getAllSkills();
    // Filter to only idle skills (gathering/production)
    const idleSkills = allSkills.filter(
      (skill) => skill.type === 'gathering' || skill.type === 'production'
    );

    let maxedSkills = 0;
    for (const skill of idleSkills) {
      const skillLevel = IdleSkillSystem.getSkillLevel(character, skill.id);
      if (skillLevel >= skill.maxLevel) {
        maxedSkills++;
      }
    }

    return {
      completed: maxedSkills,
      total: idleSkills.length,
      percentage: idleSkills.length > 0 ? (maxedSkills / idleSkills.length) * 100 : 0,
    };
  }

  /**
   * Get overall completion percentage
   */
  static getCompletionPercentage(statistics: GameStatistics, character: Character): number {
    const monsterCompletion = this.getMonsterCompletion(statistics);
    const itemCompletion = this.getItemCompletion(statistics);
    const skillCompletion = this.getSkillCompletion(character);

    const average =
      (monsterCompletion.percentage + itemCompletion.percentage + skillCompletion.percentage) / 3;

    return Math.round(average * 100) / 100; // Round to 2 decimal places
  }
}

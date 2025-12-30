import type {
  Character,
  Inventory,
  Achievement,
  CompletedAchievement,
  GameStatistics,
} from '@idle-rpg/shared';
import { getDataLoader } from '@/data';
import { InventoryManager } from '../inventory';
import { IdleSkillSystem } from '../skills/IdleSkillSystem';
import { StatisticsManager } from '../statistics/StatisticsManager';

export interface AchievementProgress {
  progress: number;
  total: number;
  percentage: number;
}

export class AchievementManager {
  /**
   * Check if an achievement is completed
   */
  static isAchievementCompleted(character: Character, achievementId: string): boolean {
    return (
      character.completedAchievements?.some((ca) => ca.achievementId === achievementId) || false
    );
  }

  /**
   * Check if achievement requirements are met
   */
  private static checkRequirements(
    achievement: Achievement,
    statistics: GameStatistics,
    character: Character
  ): boolean {
    const requirements = achievement.requirements;

    // Check monster kills
    if (requirements.monsterKills) {
      for (const [monsterId, requiredKills] of Object.entries(requirements.monsterKills)) {
        const actualKills = statistics.monsterKills[monsterId] || 0;
        if (actualKills < requiredKills) {
          return false;
        }
      }
    }

    // Check items collected
    if (requirements.itemsCollected) {
      for (const [itemId, requiredQuantity] of Object.entries(requirements.itemsCollected)) {
        const actualQuantity = statistics.itemsCollected[itemId] || 0;
        if (actualQuantity < requiredQuantity) {
          return false;
        }
      }
    }

    // Check skill actions
    if (requirements.skillActions) {
      for (const [skillId, requiredActions] of Object.entries(requirements.skillActions)) {
        const actualActions = statistics.skillActions[skillId] || 0;
        if (actualActions < requiredActions) {
          return false;
        }
      }
    }

    // Check skill levels
    if (requirements.skillLevels) {
      for (const [skillId, requiredLevel] of Object.entries(requirements.skillLevels)) {
        const actualLevel = IdleSkillSystem.getSkillLevel(character, skillId);
        if (actualLevel < requiredLevel) {
          return false;
        }
      }
    }

    // Check total combats
    if (requirements.totalCombats !== undefined) {
      if (statistics.totalCombats < requirements.totalCombats) {
        return false;
      }
    }

    // Check total gold
    if (requirements.totalGold !== undefined) {
      if (statistics.totalGoldEarned < requirements.totalGold) {
        return false;
      }
    }

    // Check total experience
    if (requirements.totalExperience !== undefined) {
      if (statistics.totalExperienceEarned < requirements.totalExperience) {
        return false;
      }
    }

    // Check total skill actions
    if (requirements.totalSkillActions !== undefined) {
      if (statistics.totalSkillActions < requirements.totalSkillActions) {
        return false;
      }
    }

    // Check total skill experience
    if (requirements.totalSkillExperience !== undefined) {
      if (statistics.totalSkillExperience < requirements.totalSkillExperience) {
        return false;
      }
    }

    // Check total play time
    if (requirements.totalPlayTime !== undefined) {
      if (statistics.totalPlayTime < requirements.totalPlayTime) {
        return false;
      }
    }

    // Check total unique items collected
    if (requirements.totalItems !== undefined) {
      // Count unique items collected (excluding gold)
      const uniqueItemsCollected = Object.keys(statistics.itemsCollected).filter(
        (itemId) => itemId !== 'gold'
      ).length;
      if (uniqueItemsCollected < requirements.totalItems) {
        return false;
      }
    }

    // Check completion percentage
    if (requirements.completionPercentage !== undefined) {
      const completionPercentage = StatisticsManager.getCompletionPercentage(statistics, character);
      if (completionPercentage < requirements.completionPercentage) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check for newly completed achievements
   */
  static checkAchievements(
    character: Character,
    statistics: GameStatistics
  ): CompletedAchievement[] {
    const dataLoader = getDataLoader();
    const allAchievements = dataLoader.getAllAchievements();
    const newlyCompleted: CompletedAchievement[] = [];

    for (const achievement of allAchievements) {
      // Skip if already completed
      if (this.isAchievementCompleted(character, achievement.id)) {
        continue;
      }

      // Skip hidden achievements that aren't completed
      if (achievement.hidden) {
        continue;
      }

      // Check if requirements are met
      if (this.checkRequirements(achievement, statistics, character)) {
        newlyCompleted.push({
          achievementId: achievement.id,
          completedAt: Date.now(),
          rewardsClaimed: false,
        });
      }
    }

    return newlyCompleted;
  }

  /**
   * Get achievement progress
   */
  static getAchievementProgress(
    achievement: Achievement,
    statistics: GameStatistics,
    character: Character
  ): AchievementProgress {
    const requirements = achievement.requirements;
    let progress = 0;
    let total = 0;

    // Calculate progress for monster kills
    if (requirements.monsterKills) {
      for (const [monsterId, requiredKills] of Object.entries(requirements.monsterKills)) {
        const actualKills = statistics.monsterKills[monsterId] || 0;
        progress += Math.min(actualKills, requiredKills);
        total += requiredKills;
      }
    }

    // Calculate progress for items collected
    if (requirements.itemsCollected) {
      for (const [itemId, requiredQuantity] of Object.entries(requirements.itemsCollected)) {
        const actualQuantity = statistics.itemsCollected[itemId] || 0;
        progress += Math.min(actualQuantity, requiredQuantity);
        total += requiredQuantity;
      }
    }

    // Calculate progress for skill actions
    if (requirements.skillActions) {
      for (const [skillId, requiredActions] of Object.entries(requirements.skillActions)) {
        const actualActions = statistics.skillActions[skillId] || 0;
        progress += Math.min(actualActions, requiredActions);
        total += requiredActions;
      }
    }

    // Calculate progress for skill levels
    if (requirements.skillLevels) {
      const dataLoader = getDataLoader();
      for (const [skillId, requiredLevel] of Object.entries(requirements.skillLevels)) {
        const skill = dataLoader.getSkill(skillId);
        if (skill) {
          const actualLevel = IdleSkillSystem.getSkillLevel(character, skillId);
          progress += Math.min(actualLevel, requiredLevel);
          total += requiredLevel;
        }
      }
    }

    // Add other requirements to total
    if (requirements.totalCombats !== undefined) {
      progress += Math.min(statistics.totalCombats, requirements.totalCombats);
      total += requirements.totalCombats;
    }

    if (requirements.totalGold !== undefined) {
      progress += Math.min(statistics.totalGoldEarned, requirements.totalGold);
      total += requirements.totalGold;
    }

    if (requirements.totalExperience !== undefined) {
      progress += Math.min(statistics.totalExperienceEarned, requirements.totalExperience);
      total += requirements.totalExperience;
    }

    if (requirements.totalSkillActions !== undefined) {
      progress += Math.min(statistics.totalSkillActions, requirements.totalSkillActions);
      total += requirements.totalSkillActions;
    }

    if (requirements.totalSkillExperience !== undefined) {
      progress += Math.min(statistics.totalSkillExperience, requirements.totalSkillExperience);
      total += requirements.totalSkillExperience;
    }

    if (requirements.totalPlayTime !== undefined) {
      progress += Math.min(statistics.totalPlayTime, requirements.totalPlayTime);
      total += requirements.totalPlayTime;
    }

    const percentage = total > 0 ? (progress / total) * 100 : 0;

    return {
      progress: Math.min(progress, total),
      total,
      percentage: Math.round(percentage * 100) / 100,
    };
  }

  /**
   * Claim achievement rewards
   */
  static claimAchievementRewards(
    character: Character,
    inventory: Inventory,
    achievementId: string
  ): {
    character: Character;
    inventory: Inventory;
    rewards: Achievement['rewards'];
  } {
    const dataLoader = getDataLoader();
    const achievement = dataLoader.getAchievement(achievementId);

    if (!achievement) {
      throw new Error(`Achievement not found: ${achievementId}`);
    }

    if (!this.isAchievementCompleted(character, achievementId)) {
      throw new Error(`Achievement not completed: ${achievementId}`);
    }

    const completedAchievement = character.completedAchievements?.find(
      (ca) => ca.achievementId === achievementId
    );

    if (!completedAchievement) {
      throw new Error(`Completed achievement not found: ${achievementId}`);
    }

    if (completedAchievement.rewardsClaimed) {
      throw new Error(`Rewards already claimed for achievement: ${achievementId}`);
    }

    let updatedInventory = inventory;
    const rewards = achievement.rewards;

    // Grant gold reward
    if (rewards?.gold) {
      updatedInventory = InventoryManager.addItem(updatedInventory, 'gold', rewards.gold);
    }

    // Grant item rewards
    if (rewards?.items) {
      for (const item of rewards.items) {
        updatedInventory = InventoryManager.addItem(updatedInventory, item.itemId, item.quantity);
      }
    }

    // Update character to mark rewards as claimed
    const updatedCompletedAchievements = (character.completedAchievements || []).map((ca) =>
      ca.achievementId === achievementId ? { ...ca, rewardsClaimed: true } : ca
    );

    const updatedCharacter: Character = {
      ...character,
      completedAchievements: updatedCompletedAchievements,
    };

    return {
      character: updatedCharacter,
      inventory: updatedInventory,
      rewards: achievement.rewards,
    };
  }
}

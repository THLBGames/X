import type { Character, AutoSkillSetting } from '@idle-rpg/shared';
import { AutoCondition, SkillType, DEFAULT_PRIORITY } from '@idle-rpg/shared';
import { getDataLoader } from '@/data';

/**
 * AutoSkillManager
 * Handles automatic skill selection based on configured conditions
 */
export class AutoSkillManager {
  /**
   * Select an auto-skill to use based on current combat state
   * Returns the skillId to use, or null if no skill should be used
   */
  static selectAutoSkill(
    character: Character,
    playerHealth: number,
    playerMaxHealth: number,
    playerMana: number,
    playerMaxMana: number,
    enemyHealth: number,
    enemyMaxHealth: number
  ): string | null {
    if (!character.skillBar || character.skillBar.length === 0) {
      return null;
    }

    if (!character.autoSkillSettings || character.autoSkillSettings.length === 0) {
      return null;
    }

    const dataLoader = getDataLoader();

    // Get all skills from skill bar that have auto-use enabled
    const enabledAutoSkills: Array<{
      skillId: string;
      setting: AutoSkillSetting;
      priority: number;
    }> = [];

    for (const skillId of character.skillBar) {
      const setting = character.autoSkillSettings.find((s) => s.skillId === skillId);
      if (!setting || !setting.enabled || setting.condition === AutoCondition.NEVER) {
        continue;
      }

      // Get skill data
      const skill = dataLoader.getSkill(skillId);
      if (!skill) {
        continue;
      }

      // Check if skill is learned
      const learnedSkill = character.learnedSkills.find((ls) => ls.skillId === skillId);
      if (!learnedSkill || learnedSkill.level === 0) {
        continue;
      }

      // Check if skill is active type
      if (skill.type !== SkillType.ACTIVE) {
        continue;
      }

      // Check mana cost
      const manaCost = skill.manaCost || 0;
      if (playerMana < manaCost) {
        continue;
      }

      // Evaluate condition
      if (
        this.evaluateCondition(
          setting,
          playerHealth,
          playerMaxHealth,
          playerMana,
          playerMaxMana,
          enemyHealth,
          enemyMaxHealth
        )
      ) {
        // Use skill bar position as default priority if not set
        const priority = setting.priority ?? character.skillBar.indexOf(skillId) + 1;
        enabledAutoSkills.push({ skillId, setting, priority });
      }
    }

    if (enabledAutoSkills.length === 0) {
      return null;
    }

    // Sort by priority (lower number = higher priority)
    enabledAutoSkills.sort((a, b) => a.priority - b.priority);

    // Return the first skill (highest priority)
    return enabledAutoSkills[0].skillId;
  }

  /**
   * Evaluate if a condition is met
   */
  private static evaluateCondition(
    setting: AutoSkillSetting,
    playerHealth: number,
    playerMaxHealth: number,
    playerMana: number,
    playerMaxMana: number,
    enemyHealth: number,
    enemyMaxHealth: number
  ): boolean {
    switch (setting.condition) {
      case AutoCondition.ALWAYS:
        return true;

      case AutoCondition.NEVER:
        return false;

      case AutoCondition.PLAYER_HEALTH_BELOW:
        if (setting.threshold === undefined) return false;
        const playerHealthPercent = (playerHealth / playerMaxHealth) * 100;
        return playerHealthPercent < setting.threshold;

      case AutoCondition.PLAYER_HEALTH_ABOVE:
        if (setting.threshold === undefined) return false;
        const playerHealthPercentAbove = (playerHealth / playerMaxHealth) * 100;
        return playerHealthPercentAbove > setting.threshold;

      case AutoCondition.PLAYER_MANA_ABOVE:
        if (setting.threshold === undefined) return false;
        const playerManaPercent = (playerMana / playerMaxMana) * 100;
        return playerManaPercent > setting.threshold;

      case AutoCondition.ENEMY_HEALTH_BELOW:
        if (setting.threshold === undefined || enemyMaxHealth === 0) return false;
        const enemyHealthPercent = (enemyHealth / enemyMaxHealth) * 100;
        return enemyHealthPercent < setting.threshold;

      case AutoCondition.ENEMY_HEALTH_ABOVE:
        if (setting.threshold === undefined || enemyMaxHealth === 0) return false;
        const enemyHealthPercentAbove = (enemyHealth / enemyMaxHealth) * 100;
        return enemyHealthPercentAbove > setting.threshold;

      default:
        return false;
    }
  }

  /**
   * Get the auto-skill setting for a skill, or create a default one
   */
  static getAutoSkillSetting(character: Character, skillId: string): AutoSkillSetting {
    const existing = character.autoSkillSettings?.find((s) => s.skillId === skillId);
    if (existing) {
      return existing;
    }

    // Default: manual only (never)
    return {
      skillId,
      enabled: false,
      condition: AutoCondition.NEVER,
      priority:
        character.skillBar?.indexOf(skillId) !== undefined
          ? character.skillBar.indexOf(skillId) + 1
          : DEFAULT_PRIORITY,
    };
  }
}

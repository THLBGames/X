import type { Character, Skill, LearnedSkill } from '@idle-rpg/shared';
import { getDataLoader } from '@/data';
import { getDataLoader } from '@/data';

export class SkillManager {
  /**
   * Check if a skill can be learned
   */
  static canLearnSkill(
    character: Character,
    skillId: string,
    skillLevel: number = 1
  ): { canLearn: boolean; reason?: string } {
    const dataLoader = getDataLoader();
    const skill = dataLoader.getSkill(skillId);

    if (!skill) {
      return { canLearn: false, reason: 'Skill not found' };
    }

    // Check if skill is already learned at max level
    const learnedSkill = character.learnedSkills.find((ls) => ls.skillId === skillId);
    if (learnedSkill && learnedSkill.level >= skill.maxLevel) {
      return { canLearn: false, reason: 'Skill already at max level' };
    }

    // Determine skill cost (unlockCost or default 1)
    const skillCost = skill.unlockCost || 1;
    const totalCost = skillCost * skillLevel;

    // Check skill points
    if (character.skillPoints < totalCost) {
      return { canLearn: false, reason: 'Not enough skill points' };
    }

    // Check level requirement (prefer unlockLevel, fallback to requirements.level)
    const requiredLevel = skill.unlockLevel || skill.requirements?.level;
    if (requiredLevel && character.level < requiredLevel) {
      return { canLearn: false, reason: `Level requirement not met (need level ${requiredLevel})` };
    }

    // Check class requirement
    if (skill.requirements?.class && !skill.requirements.class.includes(character.classId)) {
      return { canLearn: false, reason: 'Class requirement not met' };
    }

    // Check prerequisites
    if (skill.prerequisites && skill.prerequisites.length > 0) {
      for (const prereqId of skill.prerequisites) {
        const prereqLearned = character.learnedSkills.find((ls) => ls.skillId === prereqId);
        if (!prereqLearned || prereqLearned.level < 1) {
          return { canLearn: false, reason: 'Prerequisites not met' };
        }
      }
    }

    return { canLearn: true };
  }

  /**
   * Learn or upgrade a skill
   */
  static learnSkill(
    character: Character,
    skillId: string,
    skillLevel: number = 1
  ): { success: boolean; character?: Character; reason?: string } {
    const canLearn = this.canLearnSkill(character, skillId, skillLevel);

    if (!canLearn.canLearn) {
      return { success: false, reason: canLearn.reason };
    }

    const dataLoader = getDataLoader();
    const skill = dataLoader.getSkill(skillId);

    if (!skill) {
      return { success: false, reason: 'Skill not found' };
    }

    const existingSkillIndex = character.learnedSkills.findIndex((ls) => ls.skillId === skillId);
    const newLearnedSkills = [...character.learnedSkills];

    // Determine skill cost (unlockCost or default 1)
    const skillCost = skill.unlockCost || 1;
    const totalCost = skillCost * skillLevel;

    if (existingSkillIndex !== -1) {
      // Upgrade existing skill
      const existingSkill = newLearnedSkills[existingSkillIndex];
      const newLevel = Math.min(existingSkill.level + skillLevel, skill.maxLevel);
      newLearnedSkills[existingSkillIndex] = { skillId, level: newLevel };
    } else {
      // Learn new skill
      newLearnedSkills.push({ skillId, level: skillLevel });
    }

    const newSkillPoints = character.skillPoints - totalCost;

    return {
      success: true,
      character: {
        ...character,
        skillPoints: newSkillPoints,
        learnedSkills: newLearnedSkills,
      },
    };
  }

  /**
   * Get skill level for character
   */
  static getSkillLevel(character: Character, skillId: string): number {
    const learnedSkill = character.learnedSkills.find((ls) => ls.skillId === skillId);
    return learnedSkill?.level || 0;
  }

  /**
   * Check if skill is learned
   */
  static isSkillLearned(character: Character, skillId: string): boolean {
    return this.getSkillLevel(character, skillId) > 0;
  }

  /**
   * Get all available skills for character's class and subclass
   */
  static getAvailableSkills(character: Character): Skill[] {
    const dataLoader = getDataLoader();
    const characterClass = dataLoader.getClass(character.classId);

    if (!characterClass) {
      return [];
    }

    const availableSkillsSet = new Set<string>();

    // Add base class skills
    for (const skillId of characterClass.availableSkills) {
      availableSkillsSet.add(skillId);
    }

    // Add subclass skills if character has a subclass
    if (character.subclassId) {
      const subclass = dataLoader.getSubclass(character.subclassId);
      if (subclass) {
        for (const skillId of subclass.availableSkills) {
          availableSkillsSet.add(skillId);
        }
      }
    }

    // Convert set to array and load skill data
    const availableSkills: Skill[] = [];
    for (const skillId of availableSkillsSet) {
      const skill = dataLoader.getSkill(skillId);
      if (skill) {
        // Check if skill's class requirements match character's class or subclass
        const skillClassReq = skill.requirements?.class;
        if (!skillClassReq || 
            skillClassReq.includes(character.classId) || 
            (character.subclassId && skillClassReq.includes(character.subclassId))) {
          availableSkills.push(skill);
        }
      }
    }

    return availableSkills;
  }

  /**
   * Get skill tree structure (skills organized by prerequisites)
   */
  static getSkillTree(character: Character): Array<{
    skill: Skill;
    level: number;
    canLearn: boolean;
    reason?: string;
    prerequisitesMet: boolean;
  }> {
    const availableSkills = this.getAvailableSkills(character);
    const skillTree: Array<{
      skill: Skill;
      level: number;
      canLearn: boolean;
      reason?: string;
      prerequisitesMet: boolean;
    }> = [];

    for (const skill of availableSkills) {
      const level = this.getSkillLevel(character, skill.id);
      const canLearnResult = this.canLearnSkill(character, skill.id, 1);
      const prerequisitesMet =
        !skill.prerequisites ||
        skill.prerequisites.every((prereqId) => this.isSkillLearned(character, prereqId));

      skillTree.push({
        skill,
        level,
        canLearn: canLearnResult.canLearn,
        reason: canLearnResult.reason,
        prerequisitesMet,
      });
    }

    // Sort by prerequisites (skills with no prerequisites first)
    skillTree.sort((a, b) => {
      const aHasPrereq = a.skill.prerequisites && a.skill.prerequisites.length > 0;
      const bHasPrereq = b.skill.prerequisites && b.skill.prerequisites.length > 0;

      if (aHasPrereq && !bHasPrereq) return 1;
      if (!aHasPrereq && bHasPrereq) return -1;

      return a.skill.name.localeCompare(b.skill.name);
    });

    return skillTree;
  }

  /**
   * Calculate skill effect value (for active skills with scaling)
   */
  static calculateSkillEffect(
    skill: Skill,
    skillLevel: number,
    characterStats: any
  ): { damage?: number; heal?: number } {
    if (!skill.effect) {
      return {};
    }

    const result: { damage?: number; heal?: number } = {};

    // Calculate damage
    if (skill.effect.damage) {
      let damage = skill.effect.damage.base * skillLevel; // Scale with level

      if (skill.effect.damage.scaling) {
        const statValue = characterStats[skill.effect.damage.scaling.stat] || 0;
        damage += statValue * skill.effect.damage.scaling.multiplier;
      }

      result.damage = Math.floor(damage);
    }

    // Calculate heal
    if (skill.effect.heal) {
      let heal = skill.effect.heal.base * skillLevel; // Scale with level

      if (skill.effect.heal.scaling) {
        const statValue = characterStats[skill.effect.heal.scaling.stat] || 0;
        heal += statValue * skill.effect.heal.scaling.multiplier;
      }

      result.heal = Math.floor(heal);
    }

    return result;
  }

  /**
   * Get passive bonuses from all learned passive skills
   */
  static getPassiveBonuses(character: Character): {
    statBonus: Partial<Record<keyof import('@idle-rpg/shared').Stats, number>>;
    combatStatBonus: Partial<
      Record<keyof import('@idle-rpg/shared').CombatStats, number>
    >;
  } {
    const dataLoader = getDataLoader();
    const statBonus: Partial<Record<string, number>> = {};
    const combatStatBonus: Partial<Record<string, number>> = {};

    for (const learnedSkill of character.learnedSkills) {
      const skill = dataLoader.getSkill(learnedSkill.skillId);
      if (skill && skill.type === 'passive' && skill.passiveBonus) {
        // Apply passive bonuses (scale with skill level)
        if (skill.passiveBonus.statBonus) {
          Object.entries(skill.passiveBonus.statBonus).forEach(([key, value]) => {
            statBonus[key] = (statBonus[key] || 0) + (value || 0) * learnedSkill.level;
          });
        }

        if (skill.passiveBonus.combatStatBonus) {
          Object.entries(skill.passiveBonus.combatStatBonus).forEach(([key, value]) => {
            combatStatBonus[key] = (combatStatBonus[key] || 0) + (value || 0) * learnedSkill.level;
          });
        }
      }
    }

    return {
      statBonus: statBonus as any,
      combatStatBonus: combatStatBonus as any,
    };
  }
}


import type { Monster, Skill, Item, Dungeon, LootEntry } from '@idle-rpg/shared';
import type { CombatDataProvider as ICombatDataProvider } from '@idle-rpg/shared';
import { getDataLoader } from '@/data';
import { DungeonManager } from '../dungeon/DungeonManager';
import { SkillManager } from '../skills/SkillManager';

/**
 * Client-side implementation of CombatDataProvider using DataLoader and helper functions
 */
export class ClientCombatDataProvider implements ICombatDataProvider {
  getMonster(monsterId: string): Monster | null {
    const dataLoader = getDataLoader();
    return dataLoader.getMonster(monsterId);
  }

  getSkill(skillId: string): Skill | null {
    const dataLoader = getDataLoader();
    return dataLoader.getSkill(skillId);
  }

  getItem(itemId: string): Item | null {
    const dataLoader = getDataLoader();
    return dataLoader.getItem(itemId);
  }

  getDungeon(dungeonId: string): Dungeon | null {
    const dataLoader = getDataLoader();
    return dataLoader.getDungeon(dungeonId) || null;
  }

  getConfig(): { combat: { criticalDamageMultiplier: number } } {
    const dataLoader = getDataLoader();
    const config = dataLoader.getConfig();
    return {
      combat: {
        criticalDamageMultiplier: config.combat.criticalDamageMultiplier,
      },
    };
  }

  generateLoot(lootTable: LootEntry[]): Array<{ itemId: string; quantity: number }> {
    return DungeonManager.generateLoot(lootTable);
  }

  calculateSkillEffect(skill: Skill, level: number, characterStats?: any): { damage?: number; heal?: number } {
    return SkillManager.calculateSkillEffect(skill, level, characterStats);
  }
}

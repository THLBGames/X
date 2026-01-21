import type { Monster, Skill, Item, Dungeon, LootEntry } from '../types/GameTypes.js';

export interface CombatDataProvider {
  getMonster(monsterId: string): Monster | null;
  getSkill(skillId: string): Skill | null;
  getItem(itemId: string): Item | null;
  getDungeon(dungeonId: string): Dungeon | null;
  getConfig(): { combat: { criticalDamageMultiplier: number } };
  generateLoot(lootTable: LootEntry[]): Array<{ itemId: string; quantity: number }>;
  calculateSkillEffect(skill: Skill, level: number, characterStats?: any): { damage?: number; heal?: number };
}

import type { Monster, Skill, Item, Dungeon, LootEntry } from '@idle-rpg/shared';
import type { CombatDataProvider as ICombatDataProvider } from '@idle-rpg/shared';
import { MonsterModel } from '../models/Monster.js';
import { SkillModel } from '../models/Skill.js';
import { ItemModel } from '../models/Item.js';
import { DungeonModel } from '../models/Dungeon.js';
import { GameRulesService } from './GameRulesService.js';

/**
 * Server-side implementation of CombatDataProvider using database models
 */
export class ServerCombatDataProvider implements ICombatDataProvider {
  private monsterCache: Map<string, Monster | null> = new Map();
  private skillCache: Map<string, Skill | null> = new Map();
  private itemCache: Map<string, Item | null> = new Map();
  private dungeonCache: Map<string, Dungeon | null> = new Map();

  /**
   * Preload monster data (must be called before combat starts)
   */
  async preloadMonster(monsterId: string): Promise<void> {
    if (this.monsterCache.has(monsterId)) {
      return;
    }

    const dbMonster = await MonsterModel.findById(monsterId);
    if (!dbMonster) {
      this.monsterCache.set(monsterId, null);
      return;
    }

    // Convert database Monster to shared Monster type
    const monster: Monster = {
      id: dbMonster.id,
      name: dbMonster.name,
      description: dbMonster.description || undefined,
      tier: dbMonster.tier,
      level: dbMonster.level,
      isBoss: dbMonster.abilities?.some((a) => a.type === 'boss') || false,
      stats: {
        health: dbMonster.stats.health,
        maxHealth: dbMonster.stats.maxHealth,
        mana: dbMonster.stats.mana || 0,
        maxMana: dbMonster.stats.maxMana || 0,
        attack: dbMonster.stats.attack,
        defense: dbMonster.stats.defense,
        magicAttack: dbMonster.stats.magicAttack,
        magicDefense: dbMonster.stats.magicDefense,
        speed: dbMonster.stats.speed,
        criticalChance: dbMonster.stats.criticalChance || 0,
        criticalDamage: dbMonster.stats.criticalDamage || 1.5,
      },
      abilities: dbMonster.abilities?.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type as 'attack' | 'heal' | 'buff' | 'debuff',
        chance: a.chance,
        effect: a.effect as any,
      })),
      lootTable: dbMonster.loot_table || [],
      experienceReward: dbMonster.experience_reward,
      goldReward: dbMonster.gold_reward || { min: 0, max: 0 },
    };

    this.monsterCache.set(monsterId, monster);
  }

  getMonster(monsterId: string): Monster | null {
    return this.monsterCache.get(monsterId) || null;
  }

  /**
   * Preload skill data (must be called before combat starts)
   */
  async preloadSkill(skillId: string): Promise<void> {
    if (this.skillCache.has(skillId)) {
      return;
    }

    const dbSkill = await SkillModel.findById(skillId);
    if (!dbSkill) {
      this.skillCache.set(skillId, null);
      return;
    }

    // Convert database Skill to shared Skill type
    const skill: Skill = {
      id: dbSkill.id,
      name: dbSkill.name,
      description: dbSkill.description || undefined,
      type: dbSkill.type,
      level: dbSkill.level || 1,
      maxLevel: dbSkill.max_level || 1,
      manaCost: dbSkill.mana_cost || 0,
      cooldown: dbSkill.cooldown || 0,
      target: dbSkill.target as any,
      effect: dbSkill.effect as any,
      requirements: dbSkill.requirements as any,
      prerequisites: dbSkill.prerequisites || [],
      unlockCost: dbSkill.unlock_cost || 1,
      unlockLevel: dbSkill.unlock_level || 1,
      passiveBonus: dbSkill.passive_bonus as any,
    };

    this.skillCache.set(skillId, skill);
  }

  getSkill(skillId: string): Skill | null {
    return this.skillCache.get(skillId) || null;
  }

  /**
   * Preload item data (must be called before combat starts)
   */
  async preloadItem(itemId: string): Promise<void> {
    if (this.itemCache.has(itemId)) {
      return;
    }

    const dbItem = await ItemModel.findById(itemId);
    if (!dbItem) {
      this.itemCache.set(itemId, null);
      return;
    }

    // Convert database Item to shared Item type
    const item: Item = dbItem as any; // TODO: Proper conversion if needed
    this.itemCache.set(itemId, item);
  }

  getItem(itemId: string): Item | null {
    return this.itemCache.get(itemId) || null;
  }

  /**
   * Preload dungeon data (must be called before combat starts)
   */
  async preloadDungeon(dungeonId: string): Promise<void> {
    if (this.dungeonCache.has(dungeonId)) {
      return;
    }

    const dbDungeon = await DungeonModel.findById(dungeonId);
    if (!dbDungeon) {
      this.dungeonCache.set(dungeonId, null);
      return;
    }

    // Convert database Dungeon to shared Dungeon type
    const dungeon: Dungeon = dbDungeon as any; // TODO: Proper conversion if needed
    this.dungeonCache.set(dungeonId, dungeon);
  }

  getDungeon(dungeonId: string): Dungeon | null {
    return this.dungeonCache.get(dungeonId) || null;
  }

  getConfig(): { combat: { criticalDamageMultiplier: number } } {
    // Load from game rules or default
    const rules = GameRulesService.getGlobalRules();
    return {
      combat: {
        criticalDamageMultiplier: rules?.combat?.criticalDamageMultiplier || 2.0,
      },
    };
  }

  generateLoot(lootTable: LootEntry[]): Array<{ itemId: string; quantity: number }> {
    const loot: Array<{ itemId: string; quantity: number }> = [];

    for (const entry of lootTable) {
      // Skip "gold" as it's handled separately
      if (entry.itemId === 'gold') {
        continue;
      }

      if (Math.random() <= entry.chance) {
        let quantity = 1;

        if (entry.min !== undefined && entry.max !== undefined) {
          quantity = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
        } else if (entry.quantity !== undefined) {
          quantity = entry.quantity;
        }

        if (quantity > 0) {
          loot.push({ itemId: entry.itemId, quantity });
        }
      }
    }

    return loot;
  }

  calculateSkillEffect(skill: Skill, level: number, characterStats?: any): { damage?: number; heal?: number } {
    if (!skill.effect) {
      return {};
    }

    const result: { damage?: number; heal?: number } = {};

    // Calculate damage
    if (skill.effect.damage) {
      let damage = skill.effect.damage.base * level; // Scale with level

      if (skill.effect.damage.scaling) {
        const statValue = characterStats?.[skill.effect.damage.scaling.stat] || 0;
        damage += statValue * skill.effect.damage.scaling.multiplier;
      }

      result.damage = Math.floor(damage);
    }

    // Calculate heal
    if (skill.effect.heal) {
      let heal = skill.effect.heal.base * level; // Scale with level

      if (skill.effect.heal.scaling) {
        const statValue = characterStats?.[skill.effect.heal.scaling.stat] || 0;
        heal += statValue * skill.effect.heal.scaling.multiplier;
      }

      result.heal = Math.floor(heal);
    }

    return result;
  }
}

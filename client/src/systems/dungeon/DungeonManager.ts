import type { Dungeon, Monster, MonsterPool, LootEntry } from '@idle-rpg/shared';
import { getDataLoader } from '@/data';

export class DungeonManager {
  /**
   * Spawn multiple monsters (1-5) for a round
   */
  static spawnMonsterWave(
    dungeon: Dungeon,
    characterLevel: number,
    isBossRound: boolean = false
  ): Monster[] {
    // Use boss pool if it's a boss round and boss pool exists, otherwise use regular monster pools
    let pool: MonsterPool[];
    if (isBossRound && dungeon.bossPool && dungeon.bossPool.length > 0) {
      pool = dungeon.bossPool;
    } else {
      pool = dungeon.monsterPools;
    }
    
    if (!pool || pool.length === 0) {
      console.warn('No monster pool available for dungeon:', dungeon.id, 'isBossRound:', isBossRound, 'hasBossPool:', !!dungeon.bossPool, 'monsterPools length:', dungeon.monsterPools?.length);
      return [];
    }

    // Spawn 1-5 monsters
    const monsterCount = 1 + Math.floor(Math.random() * 5);
    const monsters: Monster[] = [];

    for (let i = 0; i < monsterCount; i++) {
      const monster = this.spawnMonsterFromPool(pool, characterLevel);
      if (monster) {
        monsters.push(monster);
      }
    }

    return monsters;
  }

  /**
   * Get a random monster from the dungeon's monster pool
   */
  static spawnMonster(dungeon: Dungeon, characterLevel: number): Monster | null {
    return this.spawnMonsterFromPool(dungeon.monsterPools, characterLevel);
  }

  /**
   * Spawn a monster from a specific pool
   */
  private static spawnMonsterFromPool(
    pool: MonsterPool[],
    characterLevel: number
  ): Monster | null {
    if (pool.length === 0) {
      return null;
    }

    // Calculate total weight
    const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
    if (totalWeight === 0) {
      return null;
    }

    // Select monster based on weight
    let random = Math.random() * totalWeight;
    let selectedPool: MonsterPool | null = null;

    for (const p of pool) {
      random -= p.weight;
      if (random <= 0) {
        selectedPool = p;
        break;
      }
    }

    if (!selectedPool) {
      selectedPool = pool[0];
    }

    // Load monster data
    const dataLoader = getDataLoader();
    const monsterData = dataLoader.getMonster(selectedPool.monsterId);
    if (!monsterData) {
      console.error('Monster data not found for ID:', selectedPool.monsterId);
      return null;
    }

    // Scale monster level if needed
    const minLevel = selectedPool.minLevel ?? monsterData.level;
    const maxLevel = selectedPool.maxLevel ?? monsterData.level;
    const monsterLevel = Math.max(minLevel, Math.min(maxLevel, characterLevel));

    // Create scaled monster instance
    return this.scaleMonsterToLevel(monsterData, monsterLevel);
  }

  /**
   * Scale monster stats to a specific level
   */
  private static scaleMonsterToLevel(monster: Monster, targetLevel: number): Monster {
    if (monster.level === targetLevel) {
      return { ...monster };
    }

    const levelDiff = targetLevel - monster.level;
    const scaleFactor = 1 + levelDiff * 0.1; // 10% stat increase per level

    return {
      ...monster,
      level: targetLevel,
      stats: {
        ...monster.stats,
        health: Math.floor(monster.stats.health * scaleFactor),
        maxHealth: Math.floor(monster.stats.maxHealth * scaleFactor),
        attack: Math.floor(monster.stats.attack * scaleFactor),
        defense: Math.floor(monster.stats.defense * scaleFactor),
        magicAttack: Math.floor(monster.stats.magicAttack * scaleFactor),
        magicDefense: Math.floor(monster.stats.magicDefense * scaleFactor),
      },
      experienceReward: Math.floor(monster.experienceReward * scaleFactor),
      goldReward: {
        min: Math.floor(monster.goldReward.min * scaleFactor),
        max: Math.floor(monster.goldReward.max * scaleFactor),
      },
    };
  }

  /**
   * Generate loot from loot table
   */
  static generateLoot(lootTable: LootEntry[]): Array<{ itemId: string; quantity: number }> {
    const loot: Array<{ itemId: string; quantity: number }> = [];

    for (const entry of lootTable) {
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

  /**
   * Check if dungeon is unlocked for character
   */
  static isDungeonUnlocked(
    dungeon: Dungeon,
    characterLevel: number,
    completedDungeons: string[]
  ): boolean {
    // Check level requirement
    if (dungeon.requiredLevel && characterLevel < dungeon.requiredLevel) {
      return false;
    }

    // Check prerequisite dungeon
    if (dungeon.requiredDungeonId && !completedDungeons.includes(dungeon.requiredDungeonId)) {
      return false;
    }

    // Check unlock conditions
    if (dungeon.unlockConditions) {
      if (dungeon.unlockConditions.level && characterLevel < dungeon.unlockConditions.level) {
        return false;
      }

      if (
        dungeon.unlockConditions.dungeonId &&
        !completedDungeons.includes(dungeon.unlockConditions.dungeonId)
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get available dungeons for character level
   */
  static getAvailableDungeons(
    characterLevel: number,
    completedDungeons: string[]
  ): Dungeon[] {
    const dataLoader = getDataLoader();
    const allDungeons = dataLoader.getAllDungeons();

    return allDungeons.filter((dungeon) =>
      this.isDungeonUnlocked(dungeon, characterLevel, completedDungeons)
    );
  }

  /**
   * Calculate experience reward with dungeon bonus
   */
  static calculateExperienceReward(baseExperience: number, dungeon: Dungeon): number {
    return Math.floor(baseExperience * dungeon.rewards.experienceBonus);
  }

  /**
   * Calculate gold reward with dungeon bonus
   */
  static calculateGoldReward(baseGold: number, dungeon: Dungeon): number {
    return Math.floor(baseGold * dungeon.rewards.goldBonus);
  }
}


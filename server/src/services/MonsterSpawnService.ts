import type { Monster } from '@idle-rpg/shared';
import { MonsterAbilityType } from '@idle-rpg/shared';
import { FloorNodeModel } from '../models/FloorNode.js';
import { LabyrinthFloorModel } from '../models/LabyrinthFloor.js';
import { MonsterModel } from '../models/Monster.js';

interface MonsterPool {
  monsterId: string;
  weight: number;
  minLevel?: number;
  maxLevel?: number;
}

export class MonsterSpawnService {
  /**
   * Spawn monsters for a node based on floor monster pool and node type
   */
  static async spawnMonstersForNode(
    nodeId: string,
    floorId: string,
    characterLevel: number
  ): Promise<Monster[]> {
    // Get node to determine if it's a boss room
    const node = await FloorNodeModel.findById(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // Get floor to access monster pool
    const floor = await LabyrinthFloorModel.findById(floorId);
    if (!floor) {
      throw new Error(`Floor ${floorId} not found`);
    }

    const monsterPool = floor.monster_pool || [];
    console.log(`[MonsterSpawnService] Floor ${floorId} monster pool size: ${monsterPool.length}, node type: ${node.node_type}`);

    // Determine if this is a boss node
    const isBossNode = node.node_type === 'boss';

    // Spawn monsters based on node type
    let monsterCount: number;
    if (isBossNode) {
      // Boss nodes typically have 1 boss monster
      monsterCount = 1;
    } else {
      // Regular monster spawn nodes: 1-5 monsters
      // For players under level 20, reduce chance of spawning more than 3 enemies
      if (characterLevel < 20) {
        const rand = Math.random();
        if (rand < 0.5) {
          monsterCount = 1 + Math.floor(Math.random() * 2); // 50% chance: 1-2 monsters
        } else if (rand < 0.85) {
          monsterCount = 3; // 35% chance: 3 monsters
        } else {
          monsterCount = 4 + Math.floor(Math.random() * 2); // 15% chance: 4-5 monsters
        }
      } else {
        // Level 20+: equal chance for 1-5 monsters
        monsterCount = 1 + Math.floor(Math.random() * 5);
      }
    }

    const monsters: Monster[] = [];

    for (let i = 0; i < monsterCount; i++) {
      const monster = await this.spawnMonsterFromPool(monsterPool, characterLevel, isBossNode);
      if (monster) {
        monsters.push(monster);
      }
    }

    return monsters;
  }

  /**
   * Spawn a monster from a pool based on character level
   */
  private static async spawnMonsterFromPool(
    pool: MonsterPool[],
    characterLevel: number,
    _isBoss: boolean = false
  ): Promise<Monster | null> {
    if (pool.length === 0) {
      return null;
    }

    // Calculate total weight
    const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
    if (totalWeight === 0) {
      return null;
    }

    // Filter pool by level requirements
    const availablePool = pool.filter((p) => {
      if (p.minLevel !== undefined && characterLevel < p.minLevel) return false;
      if (p.maxLevel !== undefined && characterLevel > p.maxLevel) return false;
      return true;
    });

    if (availablePool.length === 0) {
      // Fallback to all pool if none match level requirements
      const selectedPool = pool[Math.floor(Math.random() * pool.length)];
      return await this.loadAndScaleMonster(selectedPool.monsterId, characterLevel);
    }

    // Select monster based on weight
    let random = Math.random() * availablePool.reduce((sum, p) => sum + p.weight, 0);
    let selectedPool: MonsterPool | null = null;

    for (const p of availablePool) {
      random -= p.weight;
      if (random <= 0) {
        selectedPool = p;
        break;
      }
    }

    if (!selectedPool) {
      selectedPool = availablePool[0];
    }

    return await this.loadAndScaleMonster(selectedPool.monsterId, characterLevel);
  }

  /**
   * Load monster data from database and scale to character level
   */
  private static async loadAndScaleMonster(monsterId: string, targetLevel: number): Promise<Monster | null> {
    // Load monster from database
    const dbMonster = await MonsterModel.findById(monsterId);
    if (!dbMonster) {
      console.warn(`Monster ${monsterId} not found in database`);
      return null;
    }

    // Convert database Monster to shared Monster type
    const monster: Monster = {
      id: dbMonster.id,
      name: dbMonster.name,
      description: dbMonster.description || undefined,
      tier: dbMonster.tier,
      level: targetLevel, // Use target level instead of monster's base level
      isBoss: dbMonster.abilities?.some((a) => (a.type as string) === 'boss') || false,
      stats: {
        health: this.scaleStat(dbMonster.stats.health, dbMonster.level, targetLevel),
        maxHealth: this.scaleStat(dbMonster.stats.maxHealth, dbMonster.level, targetLevel),
        mana: this.scaleStat(dbMonster.stats.mana || 0, dbMonster.level, targetLevel),
        maxMana: this.scaleStat(dbMonster.stats.maxMana || 0, dbMonster.level, targetLevel),
        attack: this.scaleStat(dbMonster.stats.attack, dbMonster.level, targetLevel),
        defense: this.scaleStat(dbMonster.stats.defense, dbMonster.level, targetLevel),
        magicAttack: this.scaleStat(dbMonster.stats.magicAttack, dbMonster.level, targetLevel),
        magicDefense: this.scaleStat(dbMonster.stats.magicDefense, dbMonster.level, targetLevel),
        speed: this.scaleStat(dbMonster.stats.speed, dbMonster.level, targetLevel),
        criticalChance: dbMonster.stats.criticalChance || 0,
        criticalDamage: dbMonster.stats.criticalDamage || 1.5,
      },
      abilities: dbMonster.abilities
        ?.filter((a) => (a.type as string) !== 'boss') // Filter out 'boss' type as it's not a valid ability type
        .map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type as MonsterAbilityType,
          chance: a.chance,
          effect: a.effect as any,
        })),
      lootTable: dbMonster.loot_table || [],
      experienceReward: Math.floor(dbMonster.experience_reward * (1 + (targetLevel - dbMonster.level) * 0.1)),
      goldReward: dbMonster.gold_reward || { min: 0, max: 0 },
    };

    return monster;
  }

  /**
   * Spawn monsters for a specific wave configuration
   */
  static async spawnWaveMonsters(
    waveConfig: { monsterCount: number; monsterPool?: MonsterPool[] },
    characterLevel: number,
    floorId: string
  ): Promise<Monster[]> {
    // Use wave-specific monster pool if provided, otherwise use floor monster pool
    let pool: MonsterPool[];
    if (waveConfig.monsterPool && waveConfig.monsterPool.length > 0) {
      pool = waveConfig.monsterPool;
    } else {
      // Get floor to access monster pool
      const floor = await LabyrinthFloorModel.findById(floorId);
      if (!floor) {
        throw new Error(`Floor ${floorId} not found`);
      }
      pool = floor.monster_pool || [];
    }

    if (pool.length === 0) {
      console.warn(`No monster pool available for wave on floor ${floorId}`);
      return [];
    }

    const monsters: Monster[] = [];

    for (let i = 0; i < waveConfig.monsterCount; i++) {
      const monster = await this.spawnMonsterFromPool(pool, characterLevel, false);
      if (monster) {
        monsters.push(monster);
      }
    }

    return monsters;
  }

  /**
   * Scale a stat based on level difference (10% increase per level)
   */
  private static scaleStat(baseValue: number, baseLevel: number, targetLevel: number): number {
    if (baseLevel === targetLevel) {
      return baseValue;
    }

    const levelDiff = targetLevel - baseLevel;
    const scaleFactor = 1 + levelDiff * 0.1; // 10% stat increase per level
    return Math.floor(baseValue * scaleFactor);
  }
}

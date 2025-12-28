import type { Character, Dungeon, CombatLog, CombatRewards } from '@idle-rpg/shared';
import { getDataLoader } from '@/data';
import { CombatEngine } from '../combat';
import { DungeonManager } from '../dungeon';
import { CharacterManager } from '../character';

export interface IdleProgressResult {
  experience: number;
  gold: number;
  items: Array<{ itemId: string; quantity: number }>;
  combatsCompleted: number;
  timeSpent: number; // in seconds
}

export class IdleProgress {
  /**
   * Calculate offline progress for a character
   */
  static calculateOfflineProgress(
    character: Character,
    dungeonId: string,
    offlineTimeMs: number
  ): IdleProgressResult {
    const dataLoader = getDataLoader();
    const config = dataLoader.getConfig();
    const dungeon = dataLoader.getDungeon(dungeonId);

    if (!dungeon) {
      return {
        experience: 0,
        gold: 0,
        items: [],
        combatsCompleted: 0,
        timeSpent: 0,
      };
    }

    // Limit offline time to max hours
    const maxOfflineMs = config.idle.maxOfflineHours * 60 * 60 * 1000;
    const actualOfflineTimeMs = Math.min(offlineTimeMs, maxOfflineMs);
    const offlineTimeSeconds = actualOfflineTimeMs / 1000;

    // Calculate how many combats could have been completed
    // Estimate combat time (average 10 seconds per combat)
    const avgCombatTime = 10; // seconds
    const offlineCombatTime = offlineTimeSeconds * config.idle.offlineExpRate;
    const estimatedCombats = Math.floor(offlineCombatTime / avgCombatTime);

    // Simulate combat results
    let totalExperience = 0;
    let totalGold = 0;
    const items: Array<{ itemId: string; quantity: number }> = [];
    const itemCounts: Record<string, number> = {};

    for (let i = 0; i < estimatedCombats; i++) {
      const monster = DungeonManager.spawnMonster(dungeon, character.level);
      if (!monster) {
        continue;
      }

      // Simulate combat (assume victory)
      const rewards: CombatRewards = {
        experience: DungeonManager.calculateExperienceReward(
          monster.experienceReward,
          dungeon
        ),
        gold: DungeonManager.calculateGoldReward(
          monster.goldReward.min +
            Math.floor(
              Math.random() * (monster.goldReward.max - monster.goldReward.min + 1)
            ),
          dungeon
        ),
        items: DungeonManager.generateLoot(monster.lootTable),
      };

      totalExperience += rewards.experience;
      totalGold += rewards.gold;

      // Aggregate items
      for (const lootItem of rewards.items) {
        itemCounts[lootItem.itemId] = (itemCounts[lootItem.itemId] || 0) + lootItem.quantity;
      }
    }

    // Convert item counts to array
    for (const [itemId, quantity] of Object.entries(itemCounts)) {
      items.push({ itemId, quantity });
    }

    return {
      experience: Math.floor(totalExperience),
      gold: Math.floor(totalGold),
      items,
      combatsCompleted: estimatedCombats,
      timeSpent: offlineTimeSeconds,
    };
  }

  /**
   * Run online idle combat loop (single iteration)
   */
  static async runIdleCombatIteration(
    character: Character,
    dungeonId: string,
    autoCombat: boolean = true
  ): Promise<{
    combatLog: CombatLog;
    updatedCharacter: Character;
    rewards: CombatRewards;
  } | null> {
    const dataLoader = getDataLoader();
    const dungeon = dataLoader.getDungeon(dungeonId);

    if (!dungeon) {
      return null;
    }

    // Spawn monster
    const monster = DungeonManager.spawnMonster(dungeon, character.level);
    if (!monster) {
      return null;
    }

    // Run combat
    const combatEngine = new CombatEngine({ autoCombat });
    combatEngine.initialize(character, monster);

    // Execute combat turns until completion
    let combatLog: CombatLog | null = null;
    while (!combatEngine.isCombatOver()) {
      combatLog = combatEngine.executeTurn();
      if (combatLog) {
        break;
      }
    }

    if (!combatLog) {
      combatLog = combatEngine.generateCombatLog();
    }

    // Process rewards if victory
    if (combatLog.result === 'victory' && combatLog.rewards) {
      const rewards = combatLog.rewards;

      // Add experience
      const { character: updatedCharacter } = CharacterManager.addExperience(
        character,
        DungeonManager.calculateExperienceReward(rewards.experience, dungeon)
      );

      // Add gold (with dungeon bonus)
      const goldReward = DungeonManager.calculateGoldReward(rewards.gold, dungeon);

      return {
        combatLog,
        updatedCharacter,
        rewards: {
          ...rewards,
          experience: DungeonManager.calculateExperienceReward(rewards.experience, dungeon),
          gold: goldReward,
        },
      };
    }

    return null;
  }

  /**
   * Process offline progress and update character
   */
  static processOfflineProgress(
    character: Character,
    dungeonId: string,
    lastOfflineTime: number
  ): {
    character: Character;
    progress: IdleProgressResult;
  } {
    const now = Date.now();
    const offlineTime = now - lastOfflineTime;

    const progress = this.calculateOfflineProgress(character, dungeonId, offlineTime);

    // Apply experience
    let updatedCharacter = character;
    if (progress.experience > 0) {
      const result = CharacterManager.addExperience(updatedCharacter, progress.experience);
      updatedCharacter = result.character;
    }

    return {
      character: updatedCharacter,
      progress,
    };
  }

  /**
   * Get estimated combat time (for progress calculations)
   */
  static estimateCombatTime(characterLevel: number, monsterLevel: number): number {
    // Simple estimation based on levels
    // Higher level = longer combat (more health)
    const levelDiff = Math.abs(characterLevel - monsterLevel);
    const baseTime = 8; // Base 8 seconds
    const timePerLevelDiff = 0.5; // 0.5 seconds per level difference

    return baseTime + levelDiff * timePerLevelDiff;
  }

  /**
   * Calculate expected rewards per hour for a dungeon
   */
  static calculateExpectedRewardsPerHour(
    character: Character,
    dungeonId: string
  ): {
    experiencePerHour: number;
    goldPerHour: number;
  } {
    const dataLoader = getDataLoader();
    const dungeon = dataLoader.getDungeon(dungeonId);
    const config = dataLoader.getConfig();

    if (!dungeon || dungeon.monsterPools.length === 0) {
      return { experiencePerHour: 0, goldPerHour: 0 };
    }

    // Estimate average monster
    const avgMonster = DungeonManager.spawnMonster(dungeon, character.level);
    if (!avgMonster) {
      return { experiencePerHour: 0, goldPerHour: 0 };
    }

    const avgCombatTime = this.estimateCombatTime(character.level, avgMonster.level);
    const combatsPerHour = 3600 / avgCombatTime; // 3600 seconds per hour

    const baseExp = DungeonManager.calculateExperienceReward(
      avgMonster.experienceReward,
      dungeon
    );
    const baseGold =
      DungeonManager.calculateGoldReward(
        (avgMonster.goldReward.min + avgMonster.goldReward.max) / 2,
        dungeon
      );

    return {
      experiencePerHour: Math.floor(baseExp * combatsPerHour),
      goldPerHour: Math.floor(baseGold * combatsPerHour),
    };
  }
}


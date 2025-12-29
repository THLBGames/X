import type { Character, Dungeon, CombatLog, CombatRewards, ActiveAction } from '@idle-rpg/shared';
import { getDataLoader } from '@/data';
import { CombatEngine } from '../combat';
import { DungeonManager } from '../dungeon';
import { CharacterManager } from '../character';
import { ResourceNodeManager } from '../skills/ResourceNodeManager';
import { IdleSkillSystem } from '../skills/IdleSkillSystem';

export interface IdleProgressResult {
  experience: number;
  gold: number;
  items: Array<{ itemId: string; quantity: number }>;
  combatsCompleted: number;
  actionsCompleted: number; // For skills, number of gathering actions
  timeSpent: number; // in seconds
  died?: boolean; // True if player died during combat offline progress
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
        actionsCompleted: 0,
        timeSpent: 0,
        died: false,
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
      actionsCompleted: 0,
      timeSpent: offlineTimeSeconds,
      died: false,
    };
  }

  /**
   * Calculate offline skill progress (gathering)
   */
  static calculateOfflineSkillProgress(
    character: Character,
    skillId: string,
    nodeId: string | undefined,
    offlineTimeMs: number
  ): IdleProgressResult {
    const dataLoader = getDataLoader();
    const skill = dataLoader.getSkill(skillId);

    if (!skill || !skill.resourceNodes) {
      return {
        experience: 0,
        gold: 0,
        items: [],
        combatsCompleted: 0,
        actionsCompleted: 0,
        timeSpent: 0,
      };
    }

    // Find the node to use
    let node = nodeId
      ? IdleSkillSystem.getAvailableResourceNodes(character, skillId).find((n) => n.nodeId === nodeId)
      : ResourceNodeManager.getBestAvailableNode(character, skillId);

    if (!node) {
      // Try to find any available node
      const availableNodes = IdleSkillSystem.getAvailableResourceNodes(character, skillId);
      if (availableNodes.length === 0) {
        return {
          experience: 0,
          gold: 0,
          items: [],
          combatsCompleted: 0,
          actionsCompleted: 0,
          timeSpent: 0,
        };
      }
      node = availableNodes[0];
    }

    const offlineTimeSeconds = offlineTimeMs / 1000;
    const timePerAction = (node.timeRequired || 5000) / 1000; // Convert to seconds
    const actionsCompleted = Math.floor(offlineTimeSeconds / timePerAction);

    // Simulate gathering actions
    let totalExperience = 0;
    const items: Array<{ itemId: string; quantity: number }> = [];
    const itemCounts: Record<string, number> = {};

    // Simulate each action (use deterministic approach for consistency)
    for (let i = 0; i < actionsCompleted; i++) {
      const result = ResourceNodeManager.gatherFromNode(character, skillId, node);
      totalExperience += result.experience;

      // Aggregate items
      for (const resource of result.resources) {
        itemCounts[resource.itemId] = (itemCounts[resource.itemId] || 0) + resource.quantity;
      }

      // Update character skill level for next iteration (simplified - just increment exp)
      // Note: In a real implementation, we'd update character progressively
      // For offline simulation, we'll use the initial character level
    }

    // Convert item counts to array
    for (const [itemId, quantity] of Object.entries(itemCounts)) {
      items.push({ itemId, quantity });
    }

    return {
      experience: Math.floor(totalExperience),
      gold: 0, // Gathering skills don't give gold
      items,
      combatsCompleted: 0,
      actionsCompleted,
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
   * Process offline action progress based on active action
   */
  static processOfflineActionProgress(
    character: Character,
    activeAction: ActiveAction,
    offlineTimeMs: number,
    maxOfflineHours: number
  ): {
    character: Character;
    progress: IdleProgressResult;
  } {
    // Cap offline time to max hours
    const maxOfflineMs = maxOfflineHours * 60 * 60 * 1000;
    const actualOfflineTimeMs = Math.min(offlineTimeMs, maxOfflineMs);

    if (!activeAction) {
      // No active action, return empty progress
      return {
        character,
        progress: {
          experience: 0,
          gold: 0,
          items: [],
          combatsCompleted: 0,
          actionsCompleted: 0,
          timeSpent: 0,
        },
      };
    }

    let progress: IdleProgressResult;
    let updatedCharacter = character;

    if (activeAction.type === 'combat') {
      // Process combat offline progress
      progress = this.calculateOfflineCombatProgress(character, activeAction.dungeonId, actualOfflineTimeMs);

      // Apply experience
      if (progress.experience > 0) {
        const result = CharacterManager.addExperience(updatedCharacter, progress.experience);
        updatedCharacter = result.character;
      }

      // If player died, don't update character further
      if (progress.died) {
        return {
          character: updatedCharacter,
          progress,
        };
      }
    } else if (activeAction.type === 'skill') {
      // Process skill offline progress
      progress = this.calculateOfflineSkillProgress(
        character,
        activeAction.skillId,
        activeAction.nodeId,
        actualOfflineTimeMs
      );

      // Apply skill experience
      if (progress.experience > 0) {
        const result = IdleSkillSystem.addSkillExperience(updatedCharacter, activeAction.skillId, progress.experience);
        updatedCharacter = result.character;
      }
    } else {
      // Unknown action type
      progress = {
        experience: 0,
        gold: 0,
        items: [],
        combatsCompleted: 0,
        actionsCompleted: 0,
        timeSpent: 0,
      };
    }

    return {
      character: updatedCharacter,
      progress,
    };
  }

  /**
   * Calculate offline combat progress with death detection
   */
  static calculateOfflineCombatProgress(
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
        actionsCompleted: 0,
        timeSpent: 0,
        died: false,
      };
    }

    const offlineTimeSeconds = offlineTimeMs / 1000;

    // Calculate how many combats could have been completed
    const avgCombatTime = 10; // seconds
    const offlineCombatTime = offlineTimeSeconds * config.idle.offlineExpRate;
    const maxCombats = Math.floor(offlineCombatTime / avgCombatTime);

    // Simulate combats with death detection
    let totalExperience = 0;
    let totalGold = 0;
    const items: Array<{ itemId: string; quantity: number }> = [];
    const itemCounts: Record<string, number> = {};
    let combatsCompleted = 0;
    let playerDied = false;

    for (let i = 0; i < maxCombats; i++) {
      const monster = DungeonManager.spawnMonster(dungeon, character.level);
      if (!monster) {
        continue;
      }

      // Simplified combat simulation - check if player would win or die
      // This is a simplified version - in a real implementation, you'd run full combat simulation
      const playerPower = character.combatStats.attack + character.combatStats.magicAttack;
      const monsterHealth = monster.stats.maxHealth || monster.stats.health;
      const monsterPower = (monster.stats.attack || 0) + (monster.stats.magicAttack || 0);

      // Estimate turns needed
      const playerTurnsToKill = Math.ceil(monsterHealth / playerPower);
      const monsterTurnsToKill = Math.ceil(character.combatStats.maxHealth / monsterPower);

      // Player dies if monster would kill them first
      if (monsterTurnsToKill < playerTurnsToKill) {
        playerDied = true;
        break; // Stop processing if player dies
      }

      // Player wins
      const rewards: CombatRewards = {
        experience: DungeonManager.calculateExperienceReward(monster.experienceReward, dungeon),
        gold: DungeonManager.calculateGoldReward(
          monster.goldReward.min +
            Math.floor(Math.random() * (monster.goldReward.max - monster.goldReward.min + 1)),
          dungeon
        ),
        items: DungeonManager.generateLoot(monster.lootTable),
      };

      totalExperience += rewards.experience;
      totalGold += rewards.gold;
      combatsCompleted++;

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
      combatsCompleted,
      actionsCompleted: 0,
      timeSpent: offlineTimeSeconds,
      died: playerDied,
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


import { GlobalRulesModel } from '../models/GlobalRules.js';
import { LabyrinthModel } from '../models/Labyrinth.js';
import type { Labyrinth } from '../models/Labyrinth.js';

export interface GameRules {
  movement: {
    baseRegenRate: number; // Movement points per hour
    maxMovementPoints: number;
    defaultMovementCost: number;
  };
  combat: {
    turnBased: boolean;
    turnTimeoutSeconds: number;
    autoCombat: boolean;
  };
  fogOfWar: {
    baseVisibility: {
      exploredNodes: boolean;
      adjacentNodes: boolean;
      visibilityRange: number; // Additional nodes visible beyond adjacent
    };
  };
  bossRoom: {
    lockOnEngage: boolean;
    lockOnCapacity: boolean;
    preventExitWhenLocked: boolean;
  };
  startPoints: {
    distributionAlgorithm: 'equal' | 'random';
    preventOverlap: boolean;
  };
  roomCapacity: {
    defaultLimit: number | null;
    allowMultiplePlayers: boolean;
    bossRoomExclusive: boolean; // Boss rooms only allow one party/player
  };
}

const DEFAULT_RULES: GameRules = {
  movement: {
    baseRegenRate: 1.0,
    maxMovementPoints: 10,
    defaultMovementCost: 1,
  },
  combat: {
    turnBased: true,
    turnTimeoutSeconds: 30,
    autoCombat: true,
  },
  fogOfWar: {
    baseVisibility: {
      exploredNodes: true,
      adjacentNodes: true,
      visibilityRange: 0,
    },
  },
  bossRoom: {
    lockOnEngage: true,
    lockOnCapacity: true,
    preventExitWhenLocked: true,
  },
  startPoints: {
    distributionAlgorithm: 'equal',
    preventOverlap: true,
  },
  roomCapacity: {
    defaultLimit: null,
    allowMultiplePlayers: true,
    bossRoomExclusive: false,
  },
};

export class GameRulesService {
  private static globalRules: GameRules | null = null;
  private static rulesCache: Map<string, GameRules> = new Map();

  /**
   * Initialize and load global rules
   */
  static async initialize(): Promise<void> {
    try {
      const globalRulesData = await GlobalRulesModel.get();
      if (globalRulesData && globalRulesData.rules) {
        this.globalRules = this.mergeRules(DEFAULT_RULES, this.parseRulesFromData(globalRulesData.rules));
      } else {
        this.globalRules = DEFAULT_RULES;
      }
    } catch (error) {
      console.error('Failed to load global rules, using defaults:', error);
      this.globalRules = DEFAULT_RULES;
    }
  }

  /**
   * Get rules for a specific labyrinth (merges labyrinth-specific rules with global rules)
   */
  static async getRulesForLabyrinth(labyrinthId: string): Promise<GameRules> {
    // Check cache
    if (this.rulesCache.has(labyrinthId)) {
      return this.rulesCache.get(labyrinthId)!;
    }

    // Initialize global rules if not loaded
    if (!this.globalRules) {
      await this.initialize();
    }

    let rules = { ...this.globalRules! };

    // Load labyrinth-specific rules
    try {
      const labyrinth = await LabyrinthModel.findById(labyrinthId);
      if (labyrinth && labyrinth.rules_config) {
        const labyrinthRules = this.parseRulesFromData(labyrinth.rules_config);
        rules = this.mergeRules(rules, labyrinthRules);
      }
    } catch (error) {
      console.error(`Failed to load rules for labyrinth ${labyrinthId}:`, error);
    }

    // Cache rules
    this.rulesCache.set(labyrinthId, rules);
    return rules;
  }

  /**
   * Get global rules
   */
  static getGlobalRules(): GameRules {
    if (!this.globalRules) {
      // Return defaults if not initialized
      return DEFAULT_RULES;
    }
    return this.globalRules;
  }

  /**
   * Parse rules from data structure (can be from database or config)
   */
  private static parseRulesFromData(data: Record<string, any>): Partial<GameRules> {
    const rules: Partial<GameRules> = {};

    if (data.movement) {
      rules.movement = {
        baseRegenRate: data.movement.baseRegenRate ?? DEFAULT_RULES.movement.baseRegenRate,
        maxMovementPoints: data.movement.maxMovementPoints ?? DEFAULT_RULES.movement.maxMovementPoints,
        defaultMovementCost: data.movement.defaultMovementCost ?? DEFAULT_RULES.movement.defaultMovementCost,
      };
    }

    if (data.combat) {
      rules.combat = {
        turnBased: data.combat.turnBased ?? DEFAULT_RULES.combat.turnBased,
        turnTimeoutSeconds: data.combat.turnTimeoutSeconds ?? DEFAULT_RULES.combat.turnTimeoutSeconds,
        autoCombat: data.combat.autoCombat ?? DEFAULT_RULES.combat.autoCombat,
      };
    }

    if (data.fogOfWar) {
      rules.fogOfWar = {
        baseVisibility: {
          exploredNodes: data.fogOfWar.baseVisibility?.exploredNodes ?? DEFAULT_RULES.fogOfWar.baseVisibility.exploredNodes,
          adjacentNodes: data.fogOfWar.baseVisibility?.adjacentNodes ?? DEFAULT_RULES.fogOfWar.baseVisibility.adjacentNodes,
          visibilityRange: data.fogOfWar.baseVisibility?.visibilityRange ?? DEFAULT_RULES.fogOfWar.baseVisibility.visibilityRange,
        },
      };
    }

    if (data.bossRoom) {
      rules.bossRoom = {
        lockOnEngage: data.bossRoom.lockOnEngage ?? DEFAULT_RULES.bossRoom.lockOnEngage,
        lockOnCapacity: data.bossRoom.lockOnCapacity ?? DEFAULT_RULES.bossRoom.lockOnCapacity,
        preventExitWhenLocked: data.bossRoom.preventExitWhenLocked ?? DEFAULT_RULES.bossRoom.preventExitWhenLocked,
      };
    }

    if (data.startPoints) {
      rules.startPoints = {
        distributionAlgorithm: data.startPoints.distributionAlgorithm ?? DEFAULT_RULES.startPoints.distributionAlgorithm,
        preventOverlap: data.startPoints.preventOverlap ?? DEFAULT_RULES.startPoints.preventOverlap,
      };
    }

    if (data.roomCapacity) {
      rules.roomCapacity = {
        defaultLimit: data.roomCapacity.defaultLimit ?? DEFAULT_RULES.roomCapacity.defaultLimit,
        allowMultiplePlayers: data.roomCapacity.allowMultiplePlayers ?? DEFAULT_RULES.roomCapacity.allowMultiplePlayers,
        bossRoomExclusive: data.roomCapacity.bossRoomExclusive ?? DEFAULT_RULES.roomCapacity.bossRoomExclusive,
      };
    }

    return rules;
  }

  /**
   * Merge two rules objects (labyrinth-specific overrides global)
   */
  private static mergeRules(base: GameRules, overrides: Partial<GameRules>): GameRules {
    return {
      movement: { ...base.movement, ...overrides.movement },
      combat: { ...base.combat, ...overrides.combat },
      fogOfWar: {
        baseVisibility: {
          ...base.fogOfWar.baseVisibility,
          ...overrides.fogOfWar?.baseVisibility,
        },
      },
      bossRoom: { ...base.bossRoom, ...overrides.bossRoom },
      startPoints: { ...base.startPoints, ...overrides.startPoints },
      roomCapacity: { ...base.roomCapacity, ...overrides.roomCapacity },
    };
  }

  /**
   * Clear cache for a specific labyrinth (useful when rules are updated)
   */
  static clearCache(labyrinthId?: string): void {
    if (labyrinthId) {
      this.rulesCache.delete(labyrinthId);
    } else {
      this.rulesCache.clear();
    }
  }
}
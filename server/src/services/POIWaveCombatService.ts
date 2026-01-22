import type { Character, Monster } from '@idle-rpg/shared';
import { ServerCombatEngine } from './ServerCombatEngine.js';
import { ServerCombatDataProvider } from './ServerCombatDataProvider.js';
import { MonsterSpawnService } from './MonsterSpawnService.js';
import { FloorNodeModel } from '../models/FloorNode.js';

export interface POIWaveCombatInstance {
  combatInstanceId: string;
  nodeId: string;
  floorId: string;
  participantId: string;
  character: Character;
  combatEngine: ServerCombatEngine;
  dataProvider: ServerCombatDataProvider;
  waves: Array<{ waveNumber: number; monsterCount: number; monsterPool?: any[] }>;
  currentWave: number;
  totalWaves: number;
  waveMonsters: Monster[];
  isActive: boolean;
  startedAt: Date;
}

export class POIWaveCombatService {
  private static activeCombatInstances: Map<string, POIWaveCombatInstance> = new Map();

  /**
   * Start POI wave combat for a node
   */
  static async startPOICombat(
    nodeId: string,
    floorId: string,
    participantId: string,
    character: Character
  ): Promise<POIWaveCombatInstance> {
    // Check if combat already active for this participant
    const existing = Array.from(this.activeCombatInstances.values()).find(
      (inst) => inst.participantId === participantId && inst.isActive
    );
    if (existing) {
      throw new Error('Combat already active for this participant');
    }

    // Get node to load wave configuration
    const node = await FloorNodeModel.findById(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const poiCombat = node.metadata?.poi_combat;
    if (!poiCombat?.enabled || !poiCombat.waves || poiCombat.waves.length === 0) {
      throw new Error('Wave combat not enabled for this node');
    }

    const waves = poiCombat.waves;
    const firstWave = waves[0];

    // Create data provider and preload monster data
    const dataProvider = new ServerCombatDataProvider();
    
    // Spawn first wave monsters
    const firstWaveMonsters = await MonsterSpawnService.spawnWaveMonsters(
      firstWave,
      character.level,
      floorId
    );

    if (firstWaveMonsters.length === 0) {
      throw new Error('Failed to spawn monsters for first wave');
    }

    // Preload monster data
    for (const monster of firstWaveMonsters) {
      await dataProvider.preloadMonster(monster.id);
    }

    // Preload character skills
    if (character.learnedSkills) {
      for (const learnedSkill of character.learnedSkills) {
        await dataProvider.preloadSkill(learnedSkill.skillId);
      }
    }

    // Create combat engine
    const combatEngine = new ServerCombatEngine(dataProvider);

    // Create player participant
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _playerParticipant = {
      id: participantId,
      name: character.name,
      isPlayer: true,
      stats: { ...character.combatStats },
      currentHealth: character.combatStats.health,
      currentMana: character.combatStats.mana,
      statusEffects: [],
      isAlive: true,
    };

    // Initialize combat with first wave
    combatEngine.initialize(
      character,
      firstWaveMonsters,
      undefined, // dungeonId
      character.combatStats.health,
      character.combatStats.mana,
      undefined, // inventory - TODO: get from participant
      [] // mercenaries - TODO: support party members
    );

    // Create combat instance
    const combatInstanceId = `poi_combat_${nodeId}_${participantId}_${Date.now()}`;
    const instance: POIWaveCombatInstance = {
      combatInstanceId,
      nodeId,
      floorId,
      participantId,
      character,
      combatEngine,
      dataProvider,
      waves,
      currentWave: 1,
      totalWaves: waves.length,
      waveMonsters: firstWaveMonsters,
      isActive: true,
      startedAt: new Date(),
    };

    this.activeCombatInstances.set(combatInstanceId, instance);

    return instance;
  }

  /**
   * Get active combat instance
   */
  static getCombatInstance(combatInstanceId: string): POIWaveCombatInstance | null {
    return this.activeCombatInstances.get(combatInstanceId) || null;
  }

  /**
   * Get active combat instance for participant
   */
  static getCombatInstanceForParticipant(participantId: string): POIWaveCombatInstance | null {
    return (
      Array.from(this.activeCombatInstances.values()).find(
        (inst) => inst.participantId === participantId && inst.isActive
      ) || null
    );
  }

  /**
   * Process combat turn
   */
  static async processCombatTurn(
    combatInstanceId: string,
    queuedSkillId?: string | null,
    queuedConsumableId?: string | null
  ): Promise<CombatLog | null> {
    const instance = this.activeCombatInstances.get(combatInstanceId);
    if (!instance || !instance.isActive) {
      throw new Error('Combat instance not found or not active');
    }

    // Execute turn
    const combatLog = instance.combatEngine.executeTurn(queuedSkillId, queuedConsumableId);

    // If combat ended, check if we need to start next wave
    if (combatLog) {
      if (combatLog.result === 'victory') {
        // Wave completed - check if more waves remain
        if (instance.currentWave < instance.totalWaves) {
          // Start next wave
          await this.startNextWave(instance);
          return null; // Combat continues
        } else {
          // All waves complete
          instance.isActive = false;
          return combatLog;
        }
      } else if (combatLog.result === 'defeat') {
        // Player died - end combat
        instance.isActive = false;
        return combatLog;
      }
    }

    return combatLog;
  }

  /**
   * Automatically process combat until player turn or combat ends
   * This handles automatic monster turns
   */
  static async processAutomaticTurns(
    combatInstanceId: string,
    maxTurns: number = 100
  ): Promise<{ combatLog: CombatLog | null; isPlayerTurn: boolean }> {
    const instance = this.activeCombatInstances.get(combatInstanceId);
    if (!instance || !instance.isActive) {
      throw new Error('Combat instance not found or not active');
    }

    let turnsProcessed = 0;
    let combatLog: CombatLog | null = null;

    while (turnsProcessed < maxTurns) {
      const currentActor = instance.combatEngine.getCurrentActor();
      
      // If it's a player's turn, stop and wait for player input
      if (currentActor?.isPlayer) {
        return { combatLog: null, isPlayerTurn: true };
      }

      // Process monster turn automatically
      combatLog = await this.processCombatTurn(combatInstanceId, null, null);

      // If combat ended, return
      if (combatLog) {
        return { combatLog, isPlayerTurn: false };
      }

      turnsProcessed++;
    }

    // Reached max turns, return current state
    return { combatLog: null, isPlayerTurn: false };
  }

  /**
   * Start next wave
   */
  private static async startNextWave(instance: POIWaveCombatInstance): Promise<void> {
    const nextWaveNumber = instance.currentWave + 1;
    const nextWave = instance.waves.find((w) => w.waveNumber === nextWaveNumber);

    if (!nextWave) {
      throw new Error(`Wave ${nextWaveNumber} not found`);
    }

    // Spawn next wave monsters
    const nextWaveMonsters = await MonsterSpawnService.spawnWaveMonsters(
      nextWave,
      instance.character.level,
      instance.floorId
    );

    if (nextWaveMonsters.length === 0) {
      throw new Error(`Failed to spawn monsters for wave ${nextWaveNumber}`);
    }

    // Preload monster data
    for (const monster of nextWaveMonsters) {
      await instance.dataProvider.preloadMonster(monster.id);
    }

    // Get current player health/mana from combat engine
    const player = instance.combatEngine.getPlayer();
    const currentHealth = player?.currentHealth || instance.character.combatStats.health;
    const currentMana = player?.currentMana || instance.character.combatStats.mana;

    // Initialize combat with next wave (preserve player health/mana)
    instance.combatEngine.initialize(
      instance.character,
      nextWaveMonsters,
      undefined,
      currentHealth,
      currentMana,
      undefined,
      []
    );

    instance.currentWave = nextWaveNumber;
    instance.waveMonsters = nextWaveMonsters;
  }

  /**
   * Get current wave status
   */
  static getCurrentWave(combatInstanceId: string): { waveNumber: number; totalWaves: number } | null {
    const instance = this.activeCombatInstances.get(combatInstanceId);
    if (!instance) return null;

    return {
      waveNumber: instance.currentWave,
      totalWaves: instance.totalWaves,
    };
  }

  /**
   * End POI combat and clean up
   */
  static endPOICombat(combatInstanceId: string): void {
    this.activeCombatInstances.delete(combatInstanceId);
  }

  /**
   * Check if node has wave combat enabled
   */
  static async hasWaveCombat(nodeId: string, _floorId: string): Promise<boolean> {
    const node = await FloorNodeModel.findById(nodeId);
    if (!node) return false;

    return node.metadata?.poi_combat?.enabled === true;
  }
}

import type { Character, Monster, CombatLog } from '@idle-rpg/shared';
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

    // Validate that we have a monster pool available
    const hasWaveMonsterPool = firstWave.monsterPool && firstWave.monsterPool.length > 0;
    if (!hasWaveMonsterPool) {
      // Check floor's monster pool as fallback
      const { LabyrinthFloorModel } = await import('../models/LabyrinthFloor.js');
      const floor = await LabyrinthFloorModel.findById(floorId);
      const hasFloorMonsterPool = floor?.monster_pool && floor.monster_pool.length > 0;
      
      if (!hasFloorMonsterPool) {
        throw new Error(
          `Cannot start POI combat: No monster pool configured. ` +
          `Please configure a monster pool for floor ${floorId} in the admin panel.`
        );
      }
    }

    // Create data provider and preload monster data
    const dataProvider = new ServerCombatDataProvider();
    
    // Spawn first wave monsters
    const firstWaveMonsters = await MonsterSpawnService.spawnWaveMonsters(
      firstWave,
      character.level,
      floorId
    );

    if (firstWaveMonsters.length === 0) {
      const poolSource = hasWaveMonsterPool ? 'wave configuration' : 'floor configuration';
      throw new Error(
        `Failed to spawn monsters for first wave. ` +
        `The monster pool from ${poolSource} appears to be empty or invalid. ` +
        `Please check the floor's monster pool configuration in the admin panel.`
      );
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
   * Validate player state before processing turn
   */
  private static validatePlayerState(
    instance: POIWaveCombatInstance,
    queuedSkillId?: string | null,
    queuedConsumableId?: string | null
  ): void {
    // Validate player participant exists and is alive
    const player = instance.combatEngine.getPlayer();
    if (!player) {
      throw new Error('Player participant not found in combat');
    }
    if (!player.isAlive) {
      throw new Error('Player is dead and cannot perform actions');
    }

    // Validate skill usage if skill is queued
    if (queuedSkillId) {
      const skill = instance.dataProvider.getSkill(queuedSkillId);
      if (!skill) {
        throw new Error(`Skill ${queuedSkillId} not found`);
      }
      
      // Check if player has learned this skill
      const hasSkill = instance.character.learnedSkills?.some(
        (ls) => ls.skillId === queuedSkillId
      );
      if (!hasSkill) {
        throw new Error(`Player has not learned skill ${queuedSkillId}`);
      }

      // Validate player has enough mana
      if (skill.manaCost && player.currentMana < skill.manaCost) {
        throw new Error(`Insufficient mana: need ${skill.manaCost}, have ${player.currentMana}`);
      }
    }

    // Validate consumable usage if consumable is queued
    if (queuedConsumableId) {
      const item = instance.dataProvider.getItem(queuedConsumableId);
      if (!item) {
        throw new Error(`Item ${queuedConsumableId} not found`);
      }

      // Check if item is a consumable
      if (item.type !== 'consumable') {
        throw new Error(`Item ${queuedConsumableId} is not a consumable`);
      }

      // Validate player has item in inventory
      // Note: We need to get inventory from character or participant
      // For now, we'll rely on the combat engine to validate this
      // TODO: Add proper inventory validation when inventory is available in instance
    }

    // Validate enemy participants exist
    const participants = instance.combatEngine.getParticipants();
    const enemies = participants.filter((p) => !p.isPlayer);
    if (enemies.length === 0) {
      throw new Error('No enemy participants found in combat');
    }

    // Validate at least one enemy is alive
    const aliveEnemies = enemies.filter((e) => e.isAlive);
    if (aliveEnemies.length === 0) {
      throw new Error('All enemies are dead - combat should have ended');
    }
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

    // Validate player and combat state before processing turn
    this.validatePlayerState(instance, queuedSkillId, queuedConsumableId);

    // Execute turn
    const combatLog = instance.combatEngine.executeTurn(queuedSkillId, queuedConsumableId);

    // If combat ended, end combat (each wave is a separate combat encounter)
    if (combatLog) {
      if (combatLog.result === 'victory') {
        // Wave completed - end combat for this wave
        // The next wave will be started separately if there are more waves
        instance.isActive = false;
        return combatLog;
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
   * Preserves player state (health, mana) and initializes new wave monsters
   */
  private static async startNextWave(instance: POIWaveCombatInstance): Promise<void> {
    const nextWaveNumber = instance.currentWave + 1;
    const nextWave = instance.waves.find((w) => w.waveNumber === nextWaveNumber);

    if (!nextWave) {
      throw new Error(`Wave ${nextWaveNumber} not found`);
    }

    // Validate we're not exceeding total waves
    if (nextWaveNumber > instance.totalWaves) {
      throw new Error(`Wave ${nextWaveNumber} exceeds total waves ${instance.totalWaves}`);
    }

    // Spawn next wave monsters
    const nextWaveMonsters = await MonsterSpawnService.spawnWaveMonsters(
      nextWave,
      instance.character.level,
      instance.floorId
    );

    if (nextWaveMonsters.length === 0) {
      const hasWaveMonsterPool = nextWave.monsterPool && nextWave.monsterPool.length > 0;
      const poolSource = hasWaveMonsterPool ? 'wave configuration' : 'floor configuration';
      throw new Error(
        `Failed to spawn monsters for wave ${nextWaveNumber}. ` +
        `The monster pool from ${poolSource} appears to be empty or invalid. ` +
        `Please check the floor's monster pool configuration in the admin panel.`
      );
    }

    // Preload monster data for next wave
    for (const monster of nextWaveMonsters) {
      await instance.dataProvider.preloadMonster(monster.id);
    }

    // Get current player state from combat engine to preserve between waves
    const player = instance.combatEngine.getPlayer();
    if (!player) {
      throw new Error('Player participant not found when starting next wave');
    }

    // Preserve player health and mana between waves
    // Note: Status effects are reset between waves (standard game design)
    const currentHealth = player.currentHealth;
    const currentMana = player.currentMana;

    // Validate player is still alive before starting next wave
    if (!player.isAlive || currentHealth <= 0) {
      throw new Error('Player is dead and cannot proceed to next wave');
    }

    // Initialize combat with next wave (preserve player health/mana)
    instance.combatEngine.initialize(
      instance.character,
      nextWaveMonsters,
      undefined, // dungeonId
      currentHealth,
      currentMana,
      undefined, // inventory - TODO: get from participant
      [] // mercenaries - TODO: support party members
    );

    // Update instance with new wave information
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

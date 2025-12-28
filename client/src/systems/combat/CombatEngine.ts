import type {
  Character,
  Monster,
  CombatParticipant,
  CombatAction,
  CombatLog,
  CombatRewards,
  Skill,
} from '@idle-rpg/shared';
import { getDataLoader } from '@/data';
import { DungeonManager } from '../dungeon/DungeonManager';

export interface CombatOptions {
  autoCombat?: boolean;
  combatSpeed?: number; // Milliseconds per turn
}

export class CombatEngine {
  private participants: CombatParticipant[] = [];
  private currentTurnIndex: number = 0;
  private actions: CombatAction[] = [];
  private startTime: number = 0;
  private options: CombatOptions;

  constructor(options: CombatOptions = {}) {
    this.options = {
      autoCombat: options.autoCombat ?? true,
      combatSpeed: options.combatSpeed ?? 1000,
    };
  }

  /**
   * Initialize combat with player character and monsters
   */
  initialize(character: Character, monsters: Monster[]): void {
    const player: CombatParticipant = {
      id: 'player',
      name: character.name,
      isPlayer: true,
      stats: { ...character.combatStats },
      currentHealth: character.combatStats.health,
      currentMana: character.combatStats.mana,
      statusEffects: [],
      isAlive: true,
    };

    const monsterParticipants: CombatParticipant[] = monsters.map((monster, index) => ({
      id: `${monster.id}_${index}`,
      name: monster.name,
      isPlayer: false,
      stats: { ...monster.stats },
      currentHealth: monster.stats.health,
      currentMana: monster.stats.mana || 0,
      statusEffects: [],
      isAlive: true,
    }));

    this.participants = [player, ...monsterParticipants];
    this.currentTurnIndex = 0;
    this.actions = [];
    this.startTime = Date.now();

    // Sort by speed to determine turn order
    this.participants.sort((a, b) => b.stats.speed - a.stats.speed);
  }

  /**
   * Execute one turn of combat
   */
  executeTurn(queuedSkillId?: string | null): CombatLog | null {
    if (this.isCombatOver()) {
      return this.generateCombatLog();
    }

    const actor = this.participants[this.currentTurnIndex];
    if (!actor.isAlive) {
      this.nextTurn();
      return null;
    }

    let action: CombatAction;

    if (actor.isPlayer) {
      // Player action (can be skill or attack)
      action = this.executePlayerAction(actor, queuedSkillId);
    } else {
      // Monster action
      action = this.executeMonsterAction(actor);
    }

    this.actions.push(action);
    this.updateStatusEffects();

    if (this.isCombatOver()) {
      return this.generateCombatLog();
    }

    this.nextTurn();
    return null;
  }

  /**
   * Execute player action
   */
  private executePlayerAction(actor: CombatParticipant): CombatAction {
    const target = this.participants.find((p) => !p.isPlayer && p.isAlive);

    if (!target) {
      // No valid target
      return {
        actorId: actor.id,
        type: 'defend',
        timestamp: Date.now(),
      };
    }

    // For now, basic attack (skill system will be integrated later)
    const damage = this.calculateDamage(actor, target);
    this.applyDamage(target, damage);

    return {
      actorId: actor.id,
      targetId: target.id,
      type: 'attack',
      damage,
      timestamp: Date.now(),
    };
  }

  /**
   * Execute monster action
   */
  private executeMonsterAction(actor: CombatParticipant): CombatAction {
    const dataLoader = getDataLoader();
    // Extract base monster ID (remove index suffix like "_0", "_1", etc.)
    const baseMonsterId = actor.id.split('_').slice(0, -1).join('_') || actor.id;
    const monsterData = dataLoader.getMonster(baseMonsterId);

    if (!monsterData) {
      // Fallback to basic attack
      const target = this.participants.find((p) => p.isPlayer && p.isAlive);
      if (!target) {
        return {
          actorId: actor.id,
          type: 'defend',
          timestamp: Date.now(),
        };
      }

      const damage = this.calculateDamage(actor, target);
      this.applyDamage(target, damage);

      return {
        actorId: actor.id,
        targetId: target.id,
        type: 'attack',
        damage,
        timestamp: Date.now(),
      };
    }

    // Use monster abilities if available
    if (monsterData.abilities && monsterData.abilities.length > 0) {
      // Select random ability based on chance
      const abilities = monsterData.abilities.filter(
        (ability) => Math.random() <= ability.chance
      );

      if (abilities.length > 0) {
        const ability = abilities[Math.floor(Math.random() * abilities.length)];
        const target = this.participants.find((p) => p.isPlayer && p.isAlive);

        if (target && ability.effect.damage) {
          const damage = ability.effect.damage;
          this.applyDamage(target, damage);

          return {
            actorId: actor.id,
            targetId: target.id,
            type: 'skill',
            damage,
            timestamp: Date.now(),
          };
        }
      }
    }

    // Default to basic attack
    const target = this.participants.find((p) => p.isPlayer && p.isAlive);
    if (!target) {
      return {
        actorId: actor.id,
        type: 'defend',
        timestamp: Date.now(),
      };
    }

    const damage = this.calculateDamage(actor, target);
    this.applyDamage(target, damage);

    return {
      actorId: actor.id,
      targetId: target.id,
      type: 'attack',
      damage,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate damage between attacker and defender
   */
  private calculateDamage(attacker: CombatParticipant, defender: CombatParticipant): number {
    const dataLoader = getDataLoader();
    const config = dataLoader.getConfig();

    // Base damage from attack stat
    let damage = attacker.stats.attack;

    // Check for critical hit
    const isCritical = Math.random() * 100 < attacker.stats.criticalChance;
    if (isCritical) {
      damage *= config.combat.criticalDamageMultiplier;
    }

    // Apply defense reduction
    const defenseFactor = defender.stats.defense / (defender.stats.defense + 100);
    damage = damage * (1 - defenseFactor);

    // Ensure minimum damage of 1
    return Math.max(1, Math.floor(damage));
  }

  /**
   * Apply damage to a participant
   */
  private applyDamage(participant: CombatParticipant, damage: number): void {
    participant.currentHealth = Math.max(0, participant.currentHealth - damage);
    if (participant.currentHealth <= 0) {
      participant.isAlive = false;
    }
  }

  /**
   * Update status effects (reduce duration, apply effects)
   */
  private updateStatusEffects(): void {
    const now = Date.now();
    for (const participant of this.participants) {
      participant.statusEffects = participant.statusEffects.filter((effect) => {
        const elapsed = (now - effect.appliedAt) / 1000; // Convert to seconds
        return effect.remainingDuration === -1 || elapsed < effect.remainingDuration;
      });
    }
  }

  /**
   * Move to next turn
   */
  private nextTurn(): void {
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.participants.length;
  }

  /**
   * Check if combat is over
   */
  isCombatOver(): boolean {
    const alivePlayers = this.participants.filter((p) => p.isPlayer && p.isAlive);
    const aliveMonsters = this.participants.filter((p) => !p.isPlayer && p.isAlive);

    return alivePlayers.length === 0 || aliveMonsters.length === 0;
  }

  /**
   * Get combat result
   */
  getResult(): 'victory' | 'defeat' | 'ongoing' {
    const alivePlayers = this.participants.filter((p) => p.isPlayer && p.isAlive);
    const aliveMonsters = this.participants.filter((p) => !p.isPlayer && p.isAlive);

    if (alivePlayers.length === 0) {
      return 'defeat';
    } else if (aliveMonsters.length === 0) {
      return 'victory';
    } else {
      return 'ongoing';
    }
  }

  /**
   * Generate combat log with rewards from all defeated monsters
   */
  generateCombatLog(): CombatLog {
    const result = this.getResult();
    const duration = (Date.now() - this.startTime) / 1000;

    let rewards: CombatRewards | undefined;

    if (result === 'victory') {
      const dataLoader = getDataLoader();
      const defeatedMonsters = this.participants.filter((p) => !p.isPlayer && !p.isAlive);
      
      let totalExperience = 0;
      let totalGold = 0;
      const allItems: Array<{ itemId: string; quantity: number }> = [];
      const allChests: Array<{ itemId: string; quantity: number }> = [];

      // Process rewards from each defeated monster
      for (const monsterParticipant of defeatedMonsters) {
        // Extract base monster ID (remove index suffix)
        const baseMonsterId = monsterParticipant.id.split('_').slice(0, -1).join('_');
        const monsterData = dataLoader.getMonster(baseMonsterId);
        
        if (monsterData) {
          totalExperience += monsterData.experienceReward;
          
          const goldAmount =
            monsterData.goldReward.min +
            Math.floor(
              Math.random() * (monsterData.goldReward.max - monsterData.goldReward.min + 1)
            );
          totalGold += goldAmount;

          // Generate loot (use boss loot table if it's a boss)
          const lootTable = monsterData.isBoss && monsterData.bossLootTable
            ? monsterData.bossLootTable
            : monsterData.lootTable;

          const loot = DungeonManager.generateLoot(lootTable);
          allItems.push(...loot);

          // Chance for special chest drop (10% for bosses, 2% for normal)
          const chestChance = monsterData.isBoss ? 0.1 : 0.02;
          if (Math.random() <= chestChance) {
            // Spawn a special chest (we'll create chest items later)
            allChests.push({ itemId: 'treasure_chest', quantity: 1 });
          }
        }
      }

      rewards = {
        experience: totalExperience,
        gold: totalGold,
        items: allItems,
        chests: allChests.length > 0 ? allChests : undefined,
      };
    }

    return {
      actions: [...this.actions],
      result,
      rewards,
      duration,
    };
  }

  /**
   * Get current participants
   */
  getParticipants(): CombatParticipant[] {
    return [...this.participants];
  }

  /**
   * Get current turn actor
   */
  getCurrentActor(): CombatParticipant | null {
    return this.participants[this.currentTurnIndex] || null;
  }

  /**
   * Get participant by ID
   */
  getParticipant(id: string): CombatParticipant | null {
    return this.participants.find((p) => p.id === id) || null;
  }

  /**
   * Get player participant
   */
  getPlayer(): CombatParticipant | null {
    return this.participants.find((p) => p.isPlayer) || null;
  }

  /**
   * Get monster participant
   */
  getMonster(): CombatParticipant | null {
    return this.participants.find((p) => !p.isPlayer && p.isAlive) || null;
  }

  /**
   * Get all monster participants
   */
  getMonsters(): CombatParticipant[] {
    return this.participants.filter((p) => !p.isPlayer && p.isAlive);
  }

  /**
   * Get monster by index (for multiple monsters)
   */
  getMonsterByIndex(index: number): CombatParticipant | null {
    const monsters = this.getMonsters();
    return monsters[index] || null;
  }

  /**
   * Get recent actions (for display)
   */
  getRecentActions(count: number = 20): CombatAction[] {
    return this.actions.slice(-count);
  }

  /**
   * Get current turn number
   */
  getTurnNumber(): number {
    return Math.floor(this.actions.length / this.participants.length);
  }
}


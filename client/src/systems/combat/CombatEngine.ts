import type {
  Character,
  Monster,
  CombatParticipant,
  CombatAction,
  CombatLog,
  CombatRewards,
} from '@idle-rpg/shared';
import { getDataLoader } from '@/data';
import { DungeonManager } from '../dungeon/DungeonManager';
import { MercenaryManager } from '../mercenary/MercenaryManager';
import { SkillManager } from '../skills/SkillManager';
import { audioManager } from '../audio/AudioManager';

export interface CombatOptions {
  autoCombat?: boolean;
  combatSpeed?: number; // Milliseconds per turn
}

export class CombatEngine {
  private participants: CombatParticipant[] = [];
  private currentTurnIndex: number = 0;
  private actions: CombatAction[] = [];
  private startTime: number = 0;
  private _options: CombatOptions;
  private dungeonId?: string; // Store dungeon ID for chest drop logic
  private character: Character | null = null; // Store character reference for skill validation

  constructor(options: CombatOptions = {}) {
    this._options = {
      autoCombat: options.autoCombat ?? true,
      combatSpeed: options.combatSpeed ?? 1000,
    };
  }

  /**
   * Initialize combat with player character and monsters
   */
  initialize(character: Character, monsters: Monster[], dungeonId?: string): void {
    this.character = character;
    this.dungeonId = dungeonId;

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

    // Add combat mercenaries as participants
    const combatMercenaries = MercenaryManager.getCombatMercenaries(character);
    const mercenaryParticipants: CombatParticipant[] = combatMercenaries.map(
      (mercenary, index) => ({
        id: `mercenary_${mercenary.id}_${index}`,
        name: mercenary.name,
        isPlayer: true, // Mercenaries are on player's side
        stats: { ...mercenary.stats! },
        currentHealth: mercenary.stats!.health,
        currentMana: mercenary.stats!.mana,
        statusEffects: [],
        isAlive: true,
      })
    );

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

    this.participants = [player, ...mercenaryParticipants, ...monsterParticipants];
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
  private executePlayerAction(
    actor: CombatParticipant,
    queuedSkillId?: string | null
  ): CombatAction {
    const dataLoader = getDataLoader();

    // Try to use skill if one is queued
    if (queuedSkillId && this.character) {
      const skill = dataLoader.getSkill(queuedSkillId);
      const learnedSkill = this.character.learnedSkills.find((ls) => ls.skillId === queuedSkillId);

      // Validate skill
      if (skill && learnedSkill && learnedSkill.level > 0) {
        // Check if skill is active type
        if (skill.type === 'active' && skill.effect) {
          // Check mana cost
          const manaCost = skill.manaCost || 0;
          if (actor.currentMana >= manaCost) {
            // Deduct mana
            actor.currentMana = Math.max(0, actor.currentMana - manaCost);

            // Play skill cast sound
            audioManager.playSound('/audio/sfx/skill_cast.mp3', 0.6);

            // Calculate skill effect
            const skillEffect = SkillManager.calculateSkillEffect(
              skill,
              learnedSkill.level,
              this.character.currentStats
            );

            // Apply skill effects based on target type
            const targetType = skill.target || 'enemy';
            let action: CombatAction = {
              actorId: actor.id,
              type: 'skill',
              skillId: queuedSkillId,
              timestamp: Date.now(),
            };

            if (targetType === 'enemy' || targetType === 'all_enemies') {
              const targets =
                targetType === 'all_enemies'
                  ? this.participants.filter((p) => !p.isPlayer && p.isAlive)
                  : ([this.participants.find((p) => !p.isPlayer && p.isAlive)].filter(
                      Boolean
                    ) as CombatParticipant[]);

              if (targets.length === 0) {
                // No valid target, fall back to basic attack
                return this.executeBasicAttack(actor);
              }

              if (skillEffect.damage) {
                // Apply damage to target(s)
                let totalDamage = 0;
                for (const target of targets) {
                  if (target) {
                    const damage = skillEffect.damage!;
                    this.applyDamage(target, damage);
                    totalDamage += damage;
                  }
                }
                action.damage = totalDamage;
                action.targetId = targets[0]?.id;
              } else {
                // Skill has no damage effect but targets enemies - still execute skill (might have status effects)
                action.targetId = targets[0]?.id;
              }
            } else if (targetType === 'self' || targetType === 'all_allies') {
              const targets =
                targetType === 'all_allies'
                  ? this.participants.filter((p) => p.isPlayer && p.isAlive)
                  : [actor];

              if (skillEffect.heal) {
                // Apply healing to target(s)
                let totalHeal = 0;
                for (const target of targets) {
                  if (target) {
                    const heal = skillEffect.heal!;
                    target.currentHealth = Math.min(
                      target.currentHealth + heal,
                      target.stats.maxHealth
                    );
                    totalHeal += heal;
                  }
                }
                action.heal = totalHeal;
                action.targetId = actor.id;
              } else {
                // Skill has no heal effect but targets self/allies - still execute skill (might have status effects)
                action.targetId = actor.id;
              }
            } else if (targetType === 'ally') {
              // Find first alive ally (mercenary)
              const ally = this.participants.find(
                (p) => p.isPlayer && p.id !== 'player' && p.isAlive
              );
              if (!ally) {
                // No valid ally, fall back to basic attack
                return this.executeBasicAttack(actor);
              }

              if (skillEffect.heal) {
                const heal = skillEffect.heal;
                ally.currentHealth = Math.min(ally.currentHealth + heal, ally.stats.maxHealth);
                action.heal = heal;
                action.targetId = ally.id;
              } else {
                // Skill has no heal effect but targets ally - still execute skill (might have status effects)
                action.targetId = ally.id;
              }
            }

            // Apply status effects if skill has them
            if (skill.effect.buffId || skill.effect.debuffId) {
              action.effects = [];
              if (skill.effect.buffId) {
                action.effects.push(skill.effect.buffId);
              }
              if (skill.effect.debuffId) {
                action.effects.push(skill.effect.debuffId);
              }
            }

            return action;
          }
        }
      }
    }

    // Fall back to basic attack if no skill or skill invalid
    return this.executeBasicAttack(actor);
  }

  /**
   * Execute basic attack (fallback when no skill is used)
   */
  private executeBasicAttack(actor: CombatParticipant): CombatAction {
    const target = this.participants.find((p) => !p.isPlayer && p.isAlive);

    if (!target) {
      // No valid target
      return {
        actorId: actor.id,
        type: 'defend',
        timestamp: Date.now(),
      };
    }

    const damage = this.calculateDamage(actor, target);

    // Play attack sound
    if (actor.isPlayer) {
      audioManager.playSound('/audio/sfx/player_attack.mp3', 0.5);
    } else {
      audioManager.playSound('/audio/sfx/monster_attack.mp3', 0.5);
    }

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
   * Get a random player-side target (player or mercenary)
   */
  private getRandomPlayerTarget(): CombatParticipant | null {
    const playerTargets = this.participants.filter((p) => p.isPlayer && p.isAlive);
    if (playerTargets.length === 0) {
      return null;
    }
    // Randomly select from all player-side participants (player + mercenaries)
    return playerTargets[Math.floor(Math.random() * playerTargets.length)];
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
      const target = this.getRandomPlayerTarget();
      if (!target) {
        return {
          actorId: actor.id,
          type: 'defend',
          timestamp: Date.now(),
        };
      }

      const damage = this.calculateDamage(actor, target);
      this.applyDamage(target, damage);
      audioManager.playSound('monster_attack'); // Play sound for monster attack

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
      const abilities = monsterData.abilities.filter((ability) => Math.random() <= ability.chance);

      if (abilities.length > 0) {
        const ability = abilities[Math.floor(Math.random() * abilities.length)];
        const target = this.getRandomPlayerTarget();

        if (target && ability.effect.damage) {
          const damage = ability.effect.damage;
          this.applyDamage(target, damage);
          audioManager.playSound('monster_attack'); // Play sound for monster ability

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
    const target = this.getRandomPlayerTarget();
    if (!target) {
      return {
        actorId: actor.id,
        type: 'defend',
        timestamp: Date.now(),
      };
    }

    const damage = this.calculateDamage(actor, target);
    this.applyDamage(target, damage);
    audioManager.playSound('monster_attack'); // Play sound for monster basic attack

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
      // Play death sound
      audioManager.playSound('/audio/sfx/death.mp3', 0.7);
    } else {
      // Play hit sound
      audioManager.playSound('/audio/sfx/hit.mp3', 0.5);
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
          const lootTable =
            monsterData.isBoss && monsterData.bossLootTable
              ? monsterData.bossLootTable
              : monsterData.lootTable;

          const loot = DungeonManager.generateLoot(lootTable);
          allItems.push(...loot);

          // Check for guaranteed chest drop (endgame dungeons)
          let shouldDropChest = false;
          if (monsterData.isBoss) {
            if (this.dungeonId) {
              const dungeon = dataLoader.getDungeon(this.dungeonId);
              if (dungeon?.guaranteedBossChest) {
                // Endgame dungeon - guaranteed chest for bosses
                shouldDropChest = true;
              } else {
                // Regular boss - 10% chance
                shouldDropChest = Math.random() <= 0.1;
              }
            } else {
              // No dungeon context - use default 10% chance
              shouldDropChest = Math.random() <= 0.1;
            }
          } else {
            // Normal monsters - 2% chance
            shouldDropChest = Math.random() <= 0.02;
          }

          if (shouldDropChest) {
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

    // Play victory or defeat sound
    if (result === 'victory') {
      audioManager.playSound('/audio/sfx/victory.mp3', 0.8);
    } else if (result === 'defeat') {
      audioManager.playSound('/audio/sfx/defeat.mp3', 0.8);
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

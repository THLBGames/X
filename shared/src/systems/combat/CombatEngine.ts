import type {
  Character,
  Monster,
  CombatParticipant,
  CombatAction,
  CombatLog,
  CombatRewards,
  Inventory,
  InventoryItem,
  Skill,
  LearnedSkill,
  MonsterAbility,
  ActiveStatusEffect,
} from '../../types/GameTypes.js';
import { CombatActionType, ConsumableEffectType, ItemType, CombatResult } from '../../constants/enums.js';
import type { CombatDataProvider } from './CombatDataProvider.js';

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
  private dungeonId?: string; // Store dungeon ID for chest drop logic
  private character: Character | null = null; // Store character reference for skill validation
  private inventory: Inventory | null = null; // Store inventory reference for consumable validation
  private skillCooldowns: Map<string, number> = new Map(); // skillId -> timestamp when cooldown ends (milliseconds)
  private dataProvider: CombatDataProvider;

  constructor(dataProvider: CombatDataProvider, options: CombatOptions = {}) {
    this.dataProvider = dataProvider;
    this.options = {
      autoCombat: options.autoCombat ?? true,
      combatSpeed: options.combatSpeed ?? 1000,
    };
  }

  /**
   * Initialize combat with player character and monsters
   * @param currentHealth Optional: current health to preserve from previous combat (defaults to max)
   * @param currentMana Optional: current mana to preserve from previous combat (defaults to max)
   * @param mercenaries Optional: additional party members as CombatParticipant[]
   */
  initialize(
    character: Character,
    monsters: Monster[],
    dungeonId?: string,
    currentHealth?: number,
    currentMana?: number,
    inventory?: Inventory,
    mercenaries?: CombatParticipant[]
  ): void {
    this.character = character;
    this.inventory = inventory || null;
    this.dungeonId = dungeonId;

    // Use provided current health/mana, or default to max values
    const playerHealth = currentHealth !== undefined ? currentHealth : character.combatStats.health;
    const playerMana = currentMana !== undefined ? currentMana : character.combatStats.mana;

    const player: CombatParticipant = {
      id: 'player',
      name: character.name,
      isPlayer: true,
      stats: { ...character.combatStats },
      currentHealth: Math.min(Math.max(0, playerHealth), character.combatStats.health), // Clamp to valid range
      currentMana: Math.min(Math.max(0, playerMana), character.combatStats.mana), // Clamp to valid range
      statusEffects: [],
      isAlive: playerHealth > 0,
    };

    // Use provided mercenaries/party members, or empty array
    const mercenaryParticipants = mercenaries || [];

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
    this.skillCooldowns.clear();

    // Sort by speed to determine turn order
    this.participants.sort((a, b) => b.stats.speed - a.stats.speed);
  }

  /**
   * Execute one turn of combat
   */
  executeTurn(queuedSkillId?: string | null, queuedConsumableId?: string | null): CombatLog | null {
    if (this.isCombatOver()) {
      return this.generateCombatLog();
    }

    const actor = this.participants[this.currentTurnIndex];
    // Allow dead players to use consumables to revive themselves
    if (!actor.isAlive && !(actor.isPlayer && queuedConsumableId)) {
      this.nextTurn();
      return null;
    }

    let action: CombatAction;

    if (actor.isPlayer) {
      // Player action (can be consumable, skill, or attack)
      // Consumables take priority over skills - allow even when dead
      if (queuedConsumableId) {
        const consumableAction = this.executeConsumableAction(actor, queuedConsumableId);
        if (consumableAction) {
          action = consumableAction;
        } else if (!actor.isAlive) {
          // Dead player can't do anything else, skip turn
          this.nextTurn();
          return null;
        } else {
          // Consumable failed, try skill or attack
          action = this.executePlayerAction(actor, queuedSkillId);
        }
      } else if (!actor.isAlive) {
        // Dead player with no consumable queued, skip turn
        this.nextTurn();
        return null;
      } else {
        action = this.executePlayerAction(actor, queuedSkillId);
      }
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
    // Try to use skill if one is queued
    if (queuedSkillId && this.character) {
      const skill = this.dataProvider.getSkill(queuedSkillId);
      const learnedSkill = this.character.learnedSkills.find((ls: LearnedSkill) => ls.skillId === queuedSkillId);

      // Validate skill
      if (skill && learnedSkill && learnedSkill.level > 0) {
        // Check if skill is active type
        if (skill.type === 'active' && skill.effect) {
          // Check cooldown
          if (skill.cooldown && skill.cooldown > 0) {
            const cooldownEndTime = this.skillCooldowns.get(queuedSkillId) || 0;
            const now = Date.now();
            if (now < cooldownEndTime) {
              // Skill is on cooldown, fall back to basic attack
              return this.executeBasicAttack(actor);
            }
          }

          // Check mana cost
          const manaCost = skill.manaCost || 0;
          if (actor.currentMana >= manaCost) {
            // Deduct mana
            actor.currentMana = Math.max(0, actor.currentMana - manaCost);

            // Calculate skill effect using data provider
            const skillEffect = this.dataProvider.calculateSkillEffect(
              skill,
              learnedSkill.level,
              this.character.currentStats
            );

            // Apply skill effects based on target type
            const targetType = skill.target || 'enemy';
            let action: CombatAction = {
              actorId: actor.id,
              type: CombatActionType.SKILL,
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
                  ? this.participants.filter((p) => p.isPlayer) // Allow healing dead allies
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
                    // Revive player if they were dead and now have health
                    if (target.currentHealth > 0) {
                      target.isAlive = true;
                    }
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
              // Find first ally (mercenary/party member), including dead ones for healing
              const ally = this.participants.find(
                (p) => p.isPlayer && p.id !== 'player'
              );
              if (!ally) {
                // No valid ally, fall back to basic attack
                return this.executeBasicAttack(actor);
              }

              if (skillEffect.heal) {
                const heal = skillEffect.heal;
                ally.currentHealth = Math.min(ally.currentHealth + heal, ally.stats.maxHealth);
                // Revive ally if they were dead and now have health
                if (ally.currentHealth > 0) {
                  ally.isAlive = true;
                }
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

            // Set cooldown if skill has one
            if (skill.cooldown && skill.cooldown > 0) {
              const cooldownEndTime = Date.now() + skill.cooldown * 1000; // Convert seconds to milliseconds
              this.skillCooldowns.set(queuedSkillId, cooldownEndTime);
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
   * Execute consumable action
   */
  private executeConsumableAction(
    actor: CombatParticipant,
    itemId: string
  ): CombatAction | null {
    if (!this.character || !this.inventory) {
      return null;
    }

    const item = this.dataProvider.getItem(itemId);

    // Validate item
    if (!item || item.type !== (ItemType.CONSUMABLE as string) || !item.consumableEffect) {
      return null;
    }

    // Check if player has the item in inventory
    const inventoryItem = this.inventory.items.find((invItem: InventoryItem) => invItem.itemId === itemId);
    if (!inventoryItem || inventoryItem.quantity === 0) {
      return null;
    }

    const effect = item.consumableEffect;
    const action: CombatAction = {
      actorId: actor.id,
      type: CombatActionType.ITEM,
      itemId: itemId,
      timestamp: Date.now(),
    };

    // Apply effect based on type
    if (effect.type === ConsumableEffectType.HEAL && effect.amount) {
      const heal = effect.amount;
      actor.currentHealth = Math.min(actor.currentHealth + heal, actor.stats.maxHealth);
      // Revive player if they were dead and now have health
      if (actor.currentHealth > 0) {
        actor.isAlive = true;
      }
      action.heal = heal;
      action.targetId = actor.id;
    } else if (effect.type === ConsumableEffectType.MANA && effect.amount) {
      const manaRestore = effect.amount;
      actor.currentMana = Math.min(actor.currentMana + manaRestore, actor.stats.maxMana);
      action.manaRestore = manaRestore;
      action.targetId = actor.id;
    } else if (effect.type === ConsumableEffectType.BUFF && effect.buffId) {
      // Apply buff (would need buff system implementation)
      action.targetId = actor.id;
    } else {
      // Unknown effect type or no effect
      return null;
    }

    // Note: Item consumption should be handled by the caller to update inventory state
    return action;
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
        type: CombatActionType.DEFEND,
        timestamp: Date.now(),
      };
    }

    const damage = this.calculateDamage(actor, target);
    this.applyDamage(target, damage);

    return {
      actorId: actor.id,
      targetId: target.id,
      type: CombatActionType.ATTACK,
      damage,
      timestamp: Date.now(),
    };
  }

  /**
   * Get a random player-side target (player or mercenary/party member)
   */
  private getRandomPlayerTarget(): CombatParticipant | null {
    const playerTargets = this.participants.filter((p) => p.isPlayer && p.isAlive);
    if (playerTargets.length === 0) {
      return null;
    }
    // Randomly select from all player-side participants (player + mercenaries/party members)
    return playerTargets[Math.floor(Math.random() * playerTargets.length)];
  }

  /**
   * Execute monster action
   */
  private executeMonsterAction(actor: CombatParticipant): CombatAction {
    // Extract base monster ID (remove index suffix like "_0", "_1", etc.)
    // If ID doesn't have underscore, use the original ID
    const idParts = actor.id.split('_');
    const baseMonsterId = idParts.length > 1 ? idParts.slice(0, -1).join('_') : actor.id;
    const monsterData = this.dataProvider.getMonster(baseMonsterId);

    if (!monsterData) {
      // Fallback to basic attack
      const target = this.getRandomPlayerTarget();
      if (!target) {
        return {
          actorId: actor.id,
          type: CombatActionType.DEFEND,
          timestamp: Date.now(),
        };
      }

      const damage = this.calculateDamage(actor, target);
      this.applyDamage(target, damage);

      return {
        actorId: actor.id,
        targetId: target.id,
        type: CombatActionType.ATTACK,
        damage,
        timestamp: Date.now(),
      };
    }

    // Use monster abilities if available
    if (monsterData.abilities && monsterData.abilities.length > 0) {
      // Select random ability based on chance
      const abilities = monsterData.abilities.filter((ability: MonsterAbility) => Math.random() <= ability.chance);

      if (abilities.length > 0) {
        const ability = abilities[Math.floor(Math.random() * abilities.length)];
        const target = this.getRandomPlayerTarget();

        if (target && ability.effect.damage) {
          const damage = ability.effect.damage;
          this.applyDamage(target, damage);

          return {
            actorId: actor.id,
            targetId: target.id,
            type: CombatActionType.SKILL,
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
        type: CombatActionType.DEFEND,
        timestamp: Date.now(),
      };
    }

    const damage = this.calculateDamage(actor, target);
    this.applyDamage(target, damage);

    return {
      actorId: actor.id,
      targetId: target.id,
      type: CombatActionType.ATTACK,
      damage,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate damage between attacker and defender
   */
  private calculateDamage(attacker: CombatParticipant, defender: CombatParticipant): number {
    const config = this.dataProvider.getConfig();

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
      participant.statusEffects = participant.statusEffects.filter((effect: ActiveStatusEffect) => {
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
  getResult(): CombatResult {
    const alivePlayers = this.participants.filter((p) => p.isPlayer && p.isAlive);
    const aliveMonsters = this.participants.filter((p) => !p.isPlayer && p.isAlive);

    if (alivePlayers.length === 0) {
      return CombatResult.DEFEAT;
    } else if (aliveMonsters.length === 0) {
      return CombatResult.VICTORY;
    } else {
      return CombatResult.ONGOING;
    }
  }

  /**
   * Generate combat log with rewards from all defeated monsters
   */
  generateCombatLog(): CombatLog {
    const result = this.getResult();
    const duration = (Date.now() - this.startTime) / 1000;

    let rewards: CombatRewards | undefined;

    if (result === CombatResult.VICTORY) {
      const defeatedMonsters = this.participants.filter((p) => !p.isPlayer && !p.isAlive);

      let totalExperience = 0;
      let totalGold = 0;
      const allItems: Array<{ itemId: string; quantity: number }> = [];
      const allChests: Array<{ itemId: string; quantity: number }> = [];

      // Process rewards from each defeated monster
      for (const monsterParticipant of defeatedMonsters) {
        // Extract base monster ID (remove index suffix like "_0", "_1", etc.)
        // If ID doesn't have underscore, use the original ID
        const idParts = monsterParticipant.id.split('_');
        const baseMonsterId =
          idParts.length > 1 ? idParts.slice(0, -1).join('_') : monsterParticipant.id;
        const monsterData = this.dataProvider.getMonster(baseMonsterId);

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

          const loot = this.dataProvider.generateLoot(lootTable);
          allItems.push(...loot);

          // Check for guaranteed chest drop (endgame dungeons)
          let shouldDropChest = false;
          if (monsterData.isBoss) {
            if (this.dungeonId) {
              const dungeon = this.dataProvider.getDungeon(this.dungeonId);
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
   * Remove a participant by ID (e.g., when a mercenary is dismissed)
   */
  removeParticipant(id: string): void {
    const index = this.participants.findIndex((p) => p.id === id);
    if (index !== -1) {
      this.participants.splice(index, 1);
      // Adjust currentTurnIndex if necessary
      if (this.currentTurnIndex >= this.participants.length) {
        this.currentTurnIndex = 0;
      } else if (this.currentTurnIndex > index) {
        // If we removed a participant before the current turn, adjust the index
        this.currentTurnIndex--;
      }
    }
  }

  /**
   * Add a participant (e.g., when a party member joins combat)
   */
  addParticipant(participant: CombatParticipant): void {
    this.participants.push(participant);
    // Re-sort by speed to maintain turn order
    this.participants.sort((a, b) => b.stats.speed - a.stats.speed);
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
    return this.participants.find((p) => p.isPlayer && p.id === 'player') || null;
  }

  /**
   * Get all player participants (player + party members/mercenaries)
   */
  getPlayers(): CombatParticipant[] {
    return this.participants.filter((p) => p.isPlayer);
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

  /**
   * Get skill cooldowns as a record (for state updates)
   */
  getSkillCooldowns(): Record<string, number> {
    const cooldowns: Record<string, number> = {};
    this.skillCooldowns.forEach((endTime, skillId) => {
      cooldowns[skillId] = endTime;
    });
    return cooldowns;
  }

  /**
   * Check if a skill is on cooldown
   */
  isSkillOnCooldown(skillId: string): boolean {
    const cooldownEndTime = this.skillCooldowns.get(skillId) || 0;
    return Date.now() < cooldownEndTime;
  }

  /**
   * Get remaining cooldown time for a skill (in seconds)
   */
  getSkillCooldownRemaining(skillId: string): number {
    const cooldownEndTime = this.skillCooldowns.get(skillId) || 0;
    const remaining = cooldownEndTime - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }
}

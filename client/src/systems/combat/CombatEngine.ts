import { CombatEngine as SharedCombatEngine, type CombatOptions, type CombatAction, type CombatLog } from '@idle-rpg/shared';
import type {
  Character,
  Monster,
  CombatParticipant,
  Inventory,
} from '@idle-rpg/shared';
import { ClientCombatDataProvider } from './CombatDataProvider.js';
import { MercenaryManager } from '../mercenary/MercenaryManager';
import { audioManager } from '../audio/AudioManager';

/**
 * Client-side CombatEngine wrapper that uses shared CombatEngine
 * Handles audio playback and provides client-specific data providers
 */
export class CombatEngine extends SharedCombatEngine {
  private character: Character | null = null;
  private inventory: Inventory | null = null;
  private dungeonId?: string;

  constructor(options: CombatOptions = {}) {
    super(new ClientCombatDataProvider(), options);
  }

  /**
   * Initialize combat with player character and monsters
   * @param currentHealth Optional: current health to preserve from previous combat (defaults to max)
   * @param currentMana Optional: current mana to preserve from previous combat (defaults to max)
   */
  initialize(
    character: Character,
    monsters: Monster[],
    dungeonId?: string,
    currentHealth?: number,
    currentMana?: number,
    inventory?: Inventory
  ): void {
    this.character = character;
    this.inventory = inventory || null;
    this.dungeonId = dungeonId;

    // Get combat mercenaries and convert to CombatParticipant[]
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

    // Call parent initialize with mercenaries
    super.initialize(
      character,
      monsters,
      dungeonId,
      currentHealth,
      currentMana,
      inventory,
      mercenaryParticipants
    );
  }

  /**
   * Override executeTurn to add audio feedback
   */
  executeTurn(queuedSkillId?: string | null, queuedConsumableId?: string | null): CombatLog | null {
    const log = super.executeTurn(queuedSkillId, queuedConsumableId);
    
    // Play audio based on the last action
    if (log) {
      // Combat ended - play victory or defeat sound
      if (log.result === 'victory') {
        audioManager.playSound('/audio/sfx/victory.mp3', 0.8);
      } else if (log.result === 'defeat') {
        audioManager.playSound('/audio/sfx/defeat.mp3', 0.8);
      }
    } else {
      // Get last action for audio feedback
      const recentActions = this.getRecentActions(1);
      if (recentActions.length > 0) {
        const lastAction = recentActions[recentActions.length - 1];
        this.playActionSound(lastAction);
      }
    }
    
    return log;
  }

  /**
   * Play sound effect for combat action
   */
  private playActionSound(action: CombatAction): void {
    const actor = this.getParticipant(action.actorId);
    if (!actor) return;

    switch (action.type) {
      case 'attack':
        if (actor.isPlayer) {
          audioManager.playSound('/audio/sfx/player_attack.mp3', 0.5);
        } else {
          audioManager.playSound('/audio/sfx/monster_attack.mp3', 0.5);
        }
        if (action.damage) {
          audioManager.playSound('/audio/sfx/hit.mp3', 0.5);
        }
        break;
      case 'skill':
        audioManager.playSound('/audio/sfx/skill_cast.mp3', 0.6);
        if (action.damage) {
          audioManager.playSound('/audio/sfx/hit.mp3', 0.5);
        }
        break;
      case 'item':
        if (action.heal) {
          audioManager.playSound('/audio/sfx/heal.mp3', 0.6);
        } else if (action.manaRestore) {
          audioManager.playSound('/audio/sfx/mana_restore.mp3', 0.6);
        } else if (action.effects) {
          audioManager.playSound('/audio/sfx/buff.mp3', 0.6);
        }
        break;
    }

    // Check if participant died
    if (action.targetId) {
      const target = this.getParticipant(action.targetId);
      if (target && !target.isAlive) {
        audioManager.playSound('/audio/sfx/death.mp3', 0.7);
      }
    }
  }
}

import type { Character, Monster } from '@idle-rpg/shared';
import { CombatEngine } from './CombatEngine';

export class CombatManager {
  private static combatEngine: CombatEngine | null = null;

  /**
   * Start a new combat instance
   * @param currentHealth Optional: current health to preserve from previous combat
   * @param currentMana Optional: current mana to preserve from previous combat
   */
  static startCombat(
    character: Character,
    monsters: Monster[],
    autoCombat: boolean = true,
    dungeonId?: string,
    currentHealth?: number,
    currentMana?: number
  ): CombatEngine {
    this.combatEngine = new CombatEngine({ autoCombat });
    this.combatEngine.initialize(character, monsters, dungeonId, currentHealth, currentMana);
    return this.combatEngine;
  }

  /**
   * Get current combat engine instance
   */
  static getCurrentCombat(): CombatEngine | null {
    return this.combatEngine;
  }

  /**
   * End current combat
   */
  static endCombat(): void {
    this.combatEngine = null;
  }
}

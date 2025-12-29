import type { Character, Monster } from '@idle-rpg/shared';
import { CombatEngine } from './CombatEngine';

export class CombatManager {
  private static combatEngine: CombatEngine | null = null;

  /**
   * Start a new combat instance
   */
  static startCombat(character: Character, monsters: Monster[], autoCombat: boolean = true, dungeonId?: string): CombatEngine {
    this.combatEngine = new CombatEngine({ autoCombat });
    this.combatEngine.initialize(character, monsters, dungeonId);
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


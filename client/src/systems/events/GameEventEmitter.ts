/**
 * Game Event System
 *
 * Centralized event emitter for all game events.
 * Events are automatically handled by listeners for statistics and achievements.
 */

export type GameEvent =
  | { type: 'monster_killed'; monsterId: string }
  | { type: 'item_collected'; itemId: string; quantity: number }
  | { type: 'combat_won'; gold: number; experience: number }
  | { type: 'combat_lost' }
  | { type: 'skill_action'; skillId: string; experience?: number }
  | { type: 'level_up'; newLevel: number }
  | { type: 'quest_completed'; questId: string }
  | { type: 'item_used'; itemId: string }
  | { type: 'equipment_equipped'; itemId: string; slot: string }
  | { type: 'equipment_unequipped'; itemId: string; slot: string }
  | { type: 'play_time_updated'; deltaSeconds: number };

type EventListener = (event: GameEvent) => void;

class GameEventEmitter {
  private listeners: Set<EventListener> = new Set();

  /**
   * Subscribe to game events
   */
  on(listener: EventListener): () => void {
    this.listeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit a game event
   */
  emit(event: GameEvent): void {
    // Call all listeners synchronously
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error(`Error in event listener for ${event.type}:`, error);
      }
    }
  }

  /**
   * Remove all listeners (for cleanup)
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }
}

// Singleton instance
export const gameEventEmitter = new GameEventEmitter();

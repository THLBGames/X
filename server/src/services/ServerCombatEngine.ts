import { CombatEngine as SharedCombatEngine, type CombatOptions } from '@idle-rpg/shared';
import type {
  Character,
  Monster,
  CombatParticipant,
  CombatLog,
  Inventory,
} from '@idle-rpg/shared';
import { ServerCombatDataProvider } from './ServerCombatDataProvider.js';

/**
 * Server-side CombatEngine wrapper that uses shared CombatEngine
 * Provides server-specific data loading through CombatDataProvider
 */
export class ServerCombatEngine extends SharedCombatEngine {
  constructor(dataProvider: ServerCombatDataProvider, options: CombatOptions = {}) {
    super(dataProvider as any, options);
  }

  // All methods are inherited from SharedCombatEngine
  // The data provider handles server-specific data loading
}

// Re-export for backward compatibility
export type { CombatOptions } from '@idle-rpg/shared';

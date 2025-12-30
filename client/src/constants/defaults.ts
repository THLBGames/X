/**
 * Default values for game state and settings
 */
import { MAX_INVENTORY_SLOTS } from '@idle-rpg/shared';

/**
 * Default inventory settings
 */
export const DEFAULT_INVENTORY_MAX_SLOTS = MAX_INVENTORY_SLOTS;

/**
 * Default auto-save interval in seconds
 */
export const DEFAULT_AUTO_SAVE_INTERVAL = 30;

/**
 * Default game settings
 */
export const DEFAULT_SETTINGS = {
  soundEnabled: true,
  musicEnabled: true,
  autoCombat: true,
  combatSpeed: 3,
  showDamageNumbers: true,
  soundVolume: 100,
  musicVolume: 100,
  theme: 'dark' as const,
  fontSize: 'medium' as const,
  animationsEnabled: true,
  showTooltips: true,
  confirmItemDrop: true,
  confirmItemSell: false,
  showNotifications: true,
  autoSaveInterval: DEFAULT_AUTO_SAVE_INTERVAL,
} as const;

/**
 * Default max offline hours
 */
export const DEFAULT_MAX_OFFLINE_HOURS = 8;


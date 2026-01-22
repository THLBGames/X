/**
 * Auto-action (skill/consumable) constants
 */
import { AutoCondition } from './enums.js';

/**
 * Priority limits
 */
export const SKILL_PRIORITY_MIN = 1;
export const SKILL_PRIORITY_MAX = 8;
export const CONSUMABLE_PRIORITY_MIN = 1;
export const CONSUMABLE_PRIORITY_MAX = 3;

/**
 * Threshold limits
 */
export const THRESHOLD_MIN = 0;
export const THRESHOLD_MAX = 100;
export const DEFAULT_THRESHOLD = 50;
export const DEFAULT_PRIORITY = 1;

/**
 * Conditions that require a threshold value
 */
export const CONDITIONS_REQUIRING_THRESHOLD: AutoCondition[] = [
  AutoCondition.PLAYER_HEALTH_BELOW,
  AutoCondition.PLAYER_HEALTH_ABOVE,
  AutoCondition.PLAYER_MANA_BELOW,
  AutoCondition.PLAYER_MANA_ABOVE,
  AutoCondition.ENEMY_HEALTH_BELOW,
  AutoCondition.ENEMY_HEALTH_ABOVE,
];

/**
 * Condition descriptions for skills
 */
export const SKILL_CONDITION_DESCRIPTIONS: Record<AutoCondition, string> = {
  [AutoCondition.ALWAYS]: 'Always use when available (if mana allows)',
  [AutoCondition.NEVER]: 'Never use automatically (manual only)',
  [AutoCondition.PLAYER_HEALTH_BELOW]: 'Use when player health is below threshold',
  [AutoCondition.PLAYER_HEALTH_ABOVE]: 'Use when player health is above threshold',
  [AutoCondition.PLAYER_MANA_ABOVE]: 'Use when player mana is above threshold',
  [AutoCondition.ENEMY_HEALTH_BELOW]: 'Use when enemy health is below threshold',
  [AutoCondition.ENEMY_HEALTH_ABOVE]: 'Use when enemy health is above threshold',
  [AutoCondition.PLAYER_MANA_BELOW]: '', // Not used for skills
};

/**
 * Condition descriptions for consumables
 */
export const CONSUMABLE_CONDITION_DESCRIPTIONS: Record<AutoCondition, string> = {
  [AutoCondition.ALWAYS]: 'Always use when available (if in inventory)',
  [AutoCondition.NEVER]: 'Never use automatically (manual only)',
  [AutoCondition.PLAYER_HEALTH_BELOW]: 'Use when player health is below threshold',
  [AutoCondition.PLAYER_HEALTH_ABOVE]: 'Use when player health is above threshold',
  [AutoCondition.PLAYER_MANA_BELOW]: 'Use when player mana is below threshold',
  [AutoCondition.PLAYER_MANA_ABOVE]: 'Use when player mana is above threshold',
  [AutoCondition.ENEMY_HEALTH_BELOW]: '', // Not used for consumables
  [AutoCondition.ENEMY_HEALTH_ABOVE]: '', // Not used for consumables
};


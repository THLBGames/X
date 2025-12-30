/**
 * Item-related constants
 */
import { ConsumableEffectType } from './enums';

/**
 * Consumable effect types that are valid for use in combat (consumable bar)
 * Excludes experience and offlineTime effects which are not combat-useful
 */
export const VALID_COMBAT_CONSUMABLE_EFFECTS: ConsumableEffectType[] = [
  ConsumableEffectType.HEAL,
  ConsumableEffectType.MANA,
  ConsumableEffectType.BUFF,
];


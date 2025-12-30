/**
 * Combat-related constants
 */
import { CombatActionType, ConsumableEffectType } from './enums';
import { VALID_COMBAT_CONSUMABLE_EFFECTS } from './items';

/**
 * Re-export valid combat consumable effects for convenience
 */
export { VALID_COMBAT_CONSUMABLE_EFFECTS };

/**
 * Combat action type mappings
 */
export const COMBAT_ACTION_TYPES = {
  ATTACK: CombatActionType.ATTACK,
  SKILL: CombatActionType.SKILL,
  ITEM: CombatActionType.ITEM,
  DEFEND: CombatActionType.DEFEND,
} as const;


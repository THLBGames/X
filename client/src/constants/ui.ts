/**
 * UI strings, labels, and messages
 * These now use translation keys - components should use useTranslation hook directly
 * This file is kept for backward compatibility and type definitions
 */

import i18n from '../i18n/config';

// Helper function to get translation with interpolation
const t = (key: string, options?: Record<string, any>) => {
  return i18n.t(key, { ns: 'ui', ...options });
};

export const UI_MESSAGES = {
  // Inventory/Item messages
  ITEM_CANNOT_EQUIP_CONSUMABLE_BAR: () => t('inventory.itemCannotEquipConsumableBar'),
  ONLY_COMBAT_CONSUMABLES: () => t('inventory.onlyCombatConsumables'),
  CONSUMABLE_BAR_FULL: (slots: number) => t('inventory.consumableBarFull', { slots }),
  ITEM_ADDED_TO_CONSUMABLE_BAR: (itemName: string) => t('inventory.itemAddedToConsumableBar', { itemName }),
  ITEM_REMOVED_FROM_CONSUMABLE_BAR: (itemName: string) => t('inventory.itemRemovedFromConsumableBar', { itemName }),
  
  // Skill bar messages
  SKILL_BAR_FULL: (maxSlots: number) => t('inventory.skillBarFull', { maxSlots }),
  CANNOT_LEARN_SKILL: (reason?: string) => reason || t('inventory.cannotLearnSkill'),
  
  // Validation messages
  THRESHOLD_RANGE_ERROR: () => t('validation.thresholdRangeError'),
  SKILL_PRIORITY_RANGE_ERROR: (min: number, max: number) => t('validation.skillPriorityRangeError', { min, max }),
  CONSUMABLE_PRIORITY_RANGE_ERROR: (min: number, max: number) => t('validation.consumablePriorityRangeError', { min, max }),
  
  // Experience messages
  GAINED_EXPERIENCE: (amount: number) => t('combat.gainedExperience', { amount }),
  LEVEL_UP: (level: number) => t('combat.levelUp', { level }),
  LEVEL_UP_MULTIPLE: (levels: number, newLevel: number) => t('combat.levelUpMultiple', { levels, newLevel }),
  
  // Buff messages
  BUFF_APPLIED: (buffId: string) => t('combat.buffApplied', { buffId }),
  
  // Offline time messages
  OFFLINE_TIME_INCREASED: (hours: number, newMax: number) => t('offline.offlineTimeIncreased', { hours, newMax }),
  
  // Equipment messages
  FAILED_TO_EQUIP: () => t('inventory.failedToEquip'),
  
  // Debug messages
  LEVEL_RANGE_ERROR: () => t('validation.levelRangeError'),
  CLASS_DATA_NOT_FOUND: () => t('validation.classDataNotFound'),
} as const;

export const UI_LABELS = {
  // Auto-config modal labels
  AUTO_SKILL_CONFIG_TITLE: () => t('autoConfig.autoSkillConfigTitle'),
  AUTO_CONSUMABLE_CONFIG_TITLE: () => t('autoConfig.autoConsumableConfigTitle'),
  ENABLE_AUTOMATIC_USE: () => t('autoConfig.enableAutomaticUse'),
  CONDITION: () => t('autoConfig.condition'),
  THRESHOLD_PERCENT: () => t('autoConfig.thresholdPercent'),
  PRIORITY: () => t('autoConfig.priority'),
  SKILL_PRIORITY_RANGE: (min: number, max: number) => t('autoConfig.skillPriorityRange', { min, max }),
  CONSUMABLE_PRIORITY_RANGE: (min: number, max: number) => t('autoConfig.consumablePriorityRange', { min, max }),
  PRIORITY_HINT_SKILLS: () => t('autoConfig.priorityHintSkills'),
  PRIORITY_HINT_CONSUMABLES: () => t('autoConfig.priorityHintConsumables'),
  
  // Condition options
  NEVER_MANUAL_ONLY: () => t('autoConfig.neverManualOnly'),
  ALWAYS_WHEN_AVAILABLE: () => t('autoConfig.alwaysWhenAvailable'),
  PLAYER_HEALTH_BELOW: () => t('autoConfig.playerHealthBelow'),
  PLAYER_HEALTH_ABOVE: () => t('autoConfig.playerHealthAbove'),
  PLAYER_MANA_BELOW: () => t('autoConfig.playerManaBelow'),
  PLAYER_MANA_ABOVE: () => t('autoConfig.playerManaAbove'),
  ENEMY_HEALTH_BELOW: () => t('autoConfig.enemyHealthBelow'),
  ENEMY_HEALTH_ABOVE: () => t('autoConfig.enemyHealthAbove'),
  
  // Buttons
  CANCEL: () => t('buttons.cancel'),
  SAVE: () => t('buttons.save'),
  
  // Consumable bar
  CONSUMABLES: () => t('consumables.consumables'),
} as const;

export const UI_TOOLTIPS = {
  // Auto-use indicators
  MANUAL_USE_ONLY: () => t('tooltips.manualUseOnly'),
  AUTO_ALWAYS_AVAILABLE: () => t('tooltips.autoAlwaysAvailable'),
  AUTO_PLAYER_HEALTH_BELOW: (threshold: number) => t('tooltips.autoPlayerHealthBelow', { threshold }),
  AUTO_PLAYER_HEALTH_ABOVE: (threshold: number) => t('tooltips.autoPlayerHealthAbove', { threshold }),
  AUTO_PLAYER_MANA_BELOW: (threshold: number) => t('tooltips.autoPlayerManaBelow', { threshold }),
  AUTO_PLAYER_MANA_ABOVE: (threshold: number) => t('tooltips.autoPlayerManaAbove', { threshold }),
  AUTO_ENEMY_HEALTH_BELOW: (threshold: number) => t('tooltips.autoEnemyHealthBelow', { threshold }),
  AUTO_ENEMY_HEALTH_ABOVE: (threshold: number) => t('tooltips.autoEnemyHealthAbove', { threshold }),
  
  // Settings buttons
  CONFIGURE_AUTO_SKILL: () => t('tooltips.configureAutoSkill'),
  CONFIGURE_AUTO_CONSUMABLE: () => t('tooltips.configureAutoConsumable'),
} as const;


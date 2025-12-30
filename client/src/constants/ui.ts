/**
 * UI strings, labels, and messages
 */

export const UI_MESSAGES = {
  // Inventory/Item messages
  ITEM_CANNOT_EQUIP_CONSUMABLE_BAR: 'This item cannot be equipped to the consumable bar.',
  ONLY_COMBAT_CONSUMABLES: 'Only healing potions, mana potions, and buff items can be equipped to the consumable bar.',
  CONSUMABLE_BAR_FULL: (slots: number) => `Consumable bar is full (${slots} slots). Remove an item first.`,
  ITEM_ADDED_TO_CONSUMABLE_BAR: (itemName: string) => `${itemName} added to consumable bar`,
  ITEM_REMOVED_FROM_CONSUMABLE_BAR: (itemName: string) => `${itemName} removed from consumable bar`,
  
  // Skill bar messages
  SKILL_BAR_FULL: (maxSlots: number) => `Skill bar is full (max ${maxSlots} skills)`,
  CANNOT_LEARN_SKILL: (reason?: string) => reason || 'Cannot learn skill',
  
  // Validation messages
  THRESHOLD_RANGE_ERROR: `Threshold must be between 0 and 100`,
  SKILL_PRIORITY_RANGE_ERROR: (min: number, max: number) => `Priority must be between ${min} and ${max}`,
  CONSUMABLE_PRIORITY_RANGE_ERROR: (min: number, max: number) => `Priority must be between ${min} and ${max}`,
  
  // Experience messages
  GAINED_EXPERIENCE: (amount: number) => `Gained ${amount} experience!`,
  LEVEL_UP: (level: number) => `Level up! You are now level ${level}!`,
  LEVEL_UP_MULTIPLE: (levels: number, newLevel: number) => `Level up! You gained ${levels} levels! You are now level ${newLevel}!`,
  
  // Buff messages
  BUFF_APPLIED: (buffId: string) => `Buff applied: ${buffId}`,
  
  // Offline time messages
  OFFLINE_TIME_INCREASED: (hours: number, newMax: number) => `Maximum offline time increased by ${hours} hours! New max: ${newMax} hours`,
  
  // Equipment messages
  FAILED_TO_EQUIP: 'Failed to equip item',
  
  // Debug messages
  LEVEL_RANGE_ERROR: 'Level must be between 1 and 99',
  CLASS_DATA_NOT_FOUND: 'Class data not found',
} as const;

export const UI_LABELS = {
  // Auto-config modal labels
  AUTO_SKILL_CONFIG_TITLE: 'Auto-Skill Configuration',
  AUTO_CONSUMABLE_CONFIG_TITLE: 'Auto-Consumable Configuration',
  ENABLE_AUTOMATIC_USE: 'Enable automatic use',
  CONDITION: 'Condition:',
  THRESHOLD_PERCENT: 'Threshold (%):',
  PRIORITY: 'Priority',
  SKILL_PRIORITY_RANGE: (min: number, max: number) => `Priority (${min}-${max}, lower = higher priority):`,
  CONSUMABLE_PRIORITY_RANGE: (min: number, max: number) => `Priority (${min}-${max}, lower = higher priority):`,
  PRIORITY_HINT_SKILLS: 'Skills with lower priority numbers are used first',
  PRIORITY_HINT_CONSUMABLES: 'Consumables with lower priority numbers are used first',
  
  // Condition options
  NEVER_MANUAL_ONLY: 'Never (manual only)',
  ALWAYS_WHEN_AVAILABLE: 'Always (when available)',
  PLAYER_HEALTH_BELOW: 'Player health below %',
  PLAYER_HEALTH_ABOVE: 'Player health above %',
  PLAYER_MANA_BELOW: 'Player mana below %',
  PLAYER_MANA_ABOVE: 'Player mana above %',
  ENEMY_HEALTH_BELOW: 'Enemy health below %',
  ENEMY_HEALTH_ABOVE: 'Enemy health above %',
  
  // Buttons
  CANCEL: 'Cancel',
  SAVE: 'Save',
  
  // Consumable bar
  CONSUMABLES: 'Consumables',
} as const;

export const UI_TOOLTIPS = {
  // Auto-use indicators
  MANUAL_USE_ONLY: 'Manual use only',
  AUTO_ALWAYS_AVAILABLE: 'Auto: Always use when available',
  AUTO_PLAYER_HEALTH_BELOW: (threshold: number) => `Auto: Use when player health < ${threshold}%`,
  AUTO_PLAYER_HEALTH_ABOVE: (threshold: number) => `Auto: Use when player health > ${threshold}%`,
  AUTO_PLAYER_MANA_BELOW: (threshold: number) => `Auto: Use when player mana < ${threshold}%`,
  AUTO_PLAYER_MANA_ABOVE: (threshold: number) => `Auto: Use when player mana > ${threshold}%`,
  AUTO_ENEMY_HEALTH_BELOW: (threshold: number) => `Auto: Use when enemy health < ${threshold}%`,
  AUTO_ENEMY_HEALTH_ABOVE: (threshold: number) => `Auto: Use when enemy health > ${threshold}%`,
  
  // Settings buttons
  CONFIGURE_AUTO_SKILL: 'Configure auto-skill settings',
  CONFIGURE_AUTO_CONSUMABLE: 'Configure auto-consumable settings',
} as const;


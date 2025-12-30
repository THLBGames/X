/**
 * Enum definitions for game types
 * These enums replace string literal union types for better type safety and maintainability
 */

export enum ItemType {
  WEAPON = 'weapon',
  ARMOR = 'armor',
  ACCESSORY = 'accessory',
  CONSUMABLE = 'consumable',
  MATERIAL = 'material',
  QUEST = 'quest',
}

export enum ItemRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
  MYTHIC = 'mythic',
}

export enum ConsumableEffectType {
  HEAL = 'heal',
  MANA = 'mana',
  BUFF = 'buff',
  EXPERIENCE = 'experience',
  OFFLINE_TIME = 'offlineTime',
}

export enum CombatActionType {
  ATTACK = 'attack',
  SKILL = 'skill',
  ITEM = 'item',
  DEFEND = 'defend',
  CONSUMABLE = 'consumable', // Deprecated, use ITEM instead
}

export enum AutoCondition {
  ALWAYS = 'always',
  NEVER = 'never',
  PLAYER_HEALTH_BELOW = 'player_health_below',
  PLAYER_HEALTH_ABOVE = 'player_health_above',
  PLAYER_MANA_BELOW = 'player_mana_below',
  PLAYER_MANA_ABOVE = 'player_mana_above',
  ENEMY_HEALTH_BELOW = 'enemy_health_below',
  ENEMY_HEALTH_ABOVE = 'enemy_health_above',
}

export enum EquipmentSlot {
  WEAPON = 'weapon',
  OFFHAND = 'offhand',
  HELMET = 'helmet',
  CHEST = 'chest',
  LEGS = 'legs',
  BOOTS = 'boots',
  GLOVES = 'gloves',
  RING1 = 'ring1',
  RING2 = 'ring2',
  AMULET = 'amulet',
}

export enum SkillType {
  ACTIVE = 'active',
  PASSIVE = 'passive',
  GATHERING = 'gathering',
  PRODUCTION = 'production',
}

export enum SkillTarget {
  SELF = 'self',
  ENEMY = 'enemy',
  ALLY = 'ally',
  ALL_ENEMIES = 'all_enemies',
  ALL_ALLIES = 'all_allies',
}

export enum SkillCategory {
  GATHERING = 'gathering',
  PRODUCTION = 'production',
  HYBRID = 'hybrid',
}

export enum MonsterAbilityType {
  ATTACK = 'attack',
  HEAL = 'heal',
  BUFF = 'buff',
  DEBUFF = 'debuff',
}

export enum StatusEffectType {
  BUFF = 'buff',
  DEBUFF = 'debuff',
}

export enum UpgradeType {
  PERMANENT = 'permanent',
  CONSUMABLE = 'consumable',
}

export enum UpgradeScope {
  SKILL = 'skill',
  CATEGORY = 'category',
}

export enum UpgradeTier {
  I = 'I',
  II = 'II',
  III = 'III',
  IV = 'IV',
  V = 'V',
}

export enum MercenaryType {
  COMBAT = 'combat',
  SKILLING = 'skilling',
}

export enum QuestType {
  DUNGEON_COMPLETION = 'dungeon_completion',
  MONSTER_KILLS = 'monster_kills',
  ITEM_COLLECTION = 'item_collection',
}

export enum CombatResult {
  VICTORY = 'victory',
  DEFEAT = 'defeat',
  ONGOING = 'ongoing',
}


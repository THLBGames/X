// Import enums
import {
  ItemType,
  ItemRarity,
  ConsumableEffectType,
  CombatActionType,
  AutoCondition,
  EquipmentSlot,
  SkillType,
  SkillTarget,
  SkillCategory,
  MonsterAbilityType,
  StatusEffectType,
  UpgradeType,
  UpgradeScope,
  UpgradeTier,
  MercenaryType,
  QuestType,
  CombatResult,
} from '../constants/enums';

// Base stats that characters and monsters have
export interface Stats {
  strength: number;
  dexterity: number;
  intelligence: number;
  vitality: number;
  wisdom: number;
  luck: number;
}

// Combat stats derived from base stats
export interface CombatStats {
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  attack: number;
  defense: number;
  magicAttack: number;
  magicDefense: number;
  speed: number;
  criticalChance: number;
  criticalDamage: number;
}

// Character class definition
export interface CharacterClass {
  id: string;
  name: string;
  description: string;
  baseStats: Stats;
  statGrowth: Stats; // Stats gained per level
  availableSkills: string[]; // Skill IDs
  equipmentRestrictions?: {
    weaponTypes?: string[];
    armorTypes?: string[];
  };
  parentClass?: string; // ID of parent class (for subclasses)
  unlockLevel?: number; // Level required to unlock (default 50 for subclasses)
  isSubclass?: boolean; // true if this is a subclass
  requiredQuestId?: string; // Quest ID required to unlock this subclass
}

// Monster definition
export interface Monster {
  id: string;
  name: string;
  description?: string;
  tier: number; // Difficulty tier
  level: number;
  isBoss?: boolean; // Is this a boss monster?
  stats: CombatStats;
  abilities?: MonsterAbility[];
  lootTable: LootEntry[];
  bossLootTable?: LootEntry[]; // Unique loot for bosses
  experienceReward: number;
  goldReward: {
    min: number;
    max: number;
  };
}

export interface MonsterAbility {
  id: string;
  name: string;
  type: MonsterAbilityType;
  chance: number; // 0-1, probability of using this ability
  effect: AbilityEffect;
}

export interface AbilityEffect {
  damage?: number;
  heal?: number;
  buffId?: string;
  debuffId?: string;
}

// Item definitions
// ItemType and ItemRarity are now enums - re-export for backward compatibility
export { ItemType, ItemRarity };

export interface Item {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  rarity: ItemRarity;
  stackable: boolean;
  maxStack?: number;
  value: number; // Gold value
  requirements?: {
    level?: number;
    class?: string[];
    stats?: Partial<Stats>;
  };
  // Equipment-specific
  equipmentSlot?: EquipmentSlot;
  statBonuses?: Partial<Stats>;
  combatStatBonuses?: Partial<CombatStats>;
  maxEnchantments?: number; // Maximum number of enchantments this item can have
  enchantmentSlots?: number; // Synonym for maxEnchantments
  // Consumable-specific
  consumableEffect?: ConsumableEffect;
}

// EquipmentSlot is now an enum - re-export for backward compatibility
export { EquipmentSlot };

export interface ConsumableEffect {
  type: ConsumableEffectType;
  amount?: number;
  buffId?: string;
  duration?: number; // For buffs, in seconds
  offlineTimeHours?: number; // Hours to add to max offline time (for offline time upgrades)
  // For custom effects (like chests)
  lootTable?: LootEntry[]; // Loot table for chest-style items
  goldReward?: {
    min: number;
    max: number;
  }; // Gold reward range for chest-style items
}

// Loot table entry
export interface LootEntry {
  itemId: string;
  chance: number; // 0-1
  min?: number;
  max?: number;
  quantity?: number; // If min/max not specified
}

// Skill definitions
// SkillType, SkillTarget, and SkillCategory are now enums - re-export for backward compatibility
export { SkillType, SkillTarget, SkillCategory };

// Statistics and Achievements
export interface GameStatistics {
  // Monster kills - track each unique monster
  monsterKills: Record<string, number>; // monsterId -> kill count

  // Items collected - track each unique item
  itemsCollected: Record<string, number>; // itemId -> total quantity ever collected

  // Skill actions - track each skill
  skillActions: Record<string, number>; // skillId -> total actions completed

  // Combat statistics
  totalCombats: number;
  totalCombatVictories: number;
  totalCombatDefeats: number;
  totalGoldEarned: number;
  totalExperienceEarned: number;

  // Skill statistics
  totalSkillActions: number;
  totalSkillExperience: number;

  // Time played
  totalPlayTime: number; // in seconds
  firstPlayed: number; // timestamp
  lastPlayed: number; // timestamp
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: 'combat' | 'collection' | 'skilling' | 'completion' | 'milestone';
  requirements: {
    monsterKills?: Record<string, number>; // monsterId -> required kills
    itemsCollected?: Record<string, number>; // itemId -> required quantity
    skillActions?: Record<string, number>; // skillId -> required actions
    skillLevels?: Record<string, number>; // skillId -> required level
    totalCombats?: number;
    totalGold?: number;
    totalExperience?: number;
    totalSkillActions?: number;
    totalSkillExperience?: number;
    totalPlayTime?: number; // in seconds
    totalItems?: number; // Total unique items collected (excluding gold)
    completionPercentage?: number; // Overall game completion percentage (0-100)
  };
  rewards?: {
    gold?: number;
    items?: Array<{ itemId: string; quantity: number }>;
    title?: string; // Unlockable title
  };
  hidden?: boolean; // If true, don't show until unlocked
}

export interface CompletedAchievement {
  achievementId: string;
  completedAt: number; // timestamp
  rewardsClaimed: boolean;
}

export interface AutoSkillSetting {
  skillId: string;
  enabled: boolean; // Whether auto-use is enabled
  condition: AutoCondition;
  threshold?: number; // Percentage threshold (0-100) for condition types that need it
  priority?: number; // Priority order (lower = higher priority, 1-8)
}

export interface AutoConsumableSetting {
  itemId: string;
  enabled: boolean; // Whether auto-use is enabled
  condition: AutoCondition;
  threshold?: number; // Percentage threshold (0-100) for condition types that need it
  priority?: number; // Priority order (lower = higher priority, 1-3)
}

// Skill Upgrade system
// UpgradeType, UpgradeScope, and UpgradeTier are now enums - re-export for backward compatibility
export { UpgradeType, UpgradeScope, UpgradeTier };

export interface SkillUpgrade {
  id: string; // e.g., "mining_upgrade_I", "gathering_boost_consumable"
  name: string;
  description: string;
  type: UpgradeType;
  scope: UpgradeScope;
  skillId?: string; // Required if scope === 'skill'
  category?: SkillCategory; // Required if scope === 'category'
  tier?: UpgradeTier; // Required if type === 'permanent'
  price: number; // Base price for tier I, scales for higher tiers
  // Permanent upgrade bonuses
  bonuses?: {
    experienceMultiplier?: number;
    speedMultiplier?: number; // < 1 = faster
    yieldMultiplier?: number;
    successRateBonus?: number; // 0-1
    unlocksNodes?: string[]; // Node IDs to unlock
    unlocksRecipes?: string[]; // Recipe IDs to unlock
  };
  // Consumable upgrade properties
  actionDuration?: number; // Number of actions (for consumables)
  // Requirements
  requirements?: {
    skillLevel?: number; // Minimum skill level required
    previousTierId?: string; // Required tier I-IV to upgrade to next tier
  };
}

export interface ActiveUpgrade {
  upgradeId: string;
  tier: UpgradeTier; // For permanent upgrades
  purchasedAt: number; // Timestamp
  remainingActions?: number; // For consumables
}

// Divination Unlock Tree system
export interface UnlockTreeNode {
  id: string; // e.g., "divination_combat_boost_1"
  name: string;
  description: string;
  category: 'combat' | 'skilling' | 'inventory' | 'utility';
  cost: Array<{ itemId: string; quantity: number }>; // Divination resources
  prerequisites?: string[]; // Other unlock node IDs
  skillLevelRequirement?: number; // Divination skill level required
  bonuses: {
    // Combat bonuses
    statBonus?: Partial<Stats>; // +strength, +intelligence, etc.
    combatStatBonus?: Partial<CombatStats>; // +attack, +defense, etc.
    combatMultiplier?: {
      experience?: number; // Combat XP multiplier
      gold?: number; // Combat gold multiplier
      itemDropRate?: number; // Item drop rate multiplier
    };
    // Skilling bonuses
    skillMultiplier?: {
      experience?: number; // Skill XP multiplier (all skills)
      speed?: number; // Skill speed multiplier
      yield?: number; // Resource yield multiplier
    };
    // Inventory bonuses
    inventorySlots?: number; // Additional inventory slots
    // Utility bonuses
    offlineTimeHours?: number; // Additional offline time
    maxMercenaries?: number; // Additional mercenary slots
  };
}

export interface DivinationUnlockBonuses {
  // Aggregated bonuses from all unlocked nodes
  statBonus?: Partial<Stats>;
  combatStatBonus?: Partial<CombatStats>;
  combatMultiplier?: {
    experience?: number;
    gold?: number;
    itemDropRate?: number;
  };
  skillMultiplier?: {
    experience?: number;
    speed?: number;
    yield?: number;
  };
  inventorySlots?: number;
  offlineTimeHours?: number;
  maxMercenaries?: number;
}

// Mercenary system
// MercenaryType is now an enum - re-export for backward compatibility
export { MercenaryType };

export interface Mercenary {
  id: string;
  name: string;
  description: string;
  type: MercenaryType;
  price: number; // One-time rental cost
  duration: number; // Battles for combat, actions for skilling
  // Combat mercenary properties
  stats?: CombatStats; // Stats if combat type
  // Skilling mercenary properties
  bonuses?: {
    experienceMultiplier?: number; // e.g., 1.5 = 50% more XP
    speedMultiplier?: number; // e.g., 0.8 = 20% faster
    yieldMultiplier?: number; // e.g., 1.3 = 30% more resources
  };
}

export interface ActiveMercenary {
  mercenaryId: string;
  rentedAt: number; // Timestamp
  remainingBattles?: number; // For combat mercenaries
  remainingActions?: number; // For skilling mercenaries
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  type: SkillType;
  category?: SkillCategory; // For idle skills
  maxLevel: number;
  prerequisites?: string[]; // Skill IDs that must be learned first
  requirements?: {
    level?: number;
    class?: string[];
  };
  unlockLevel?: number; // Minimum level to unlock (alternative to requirements.level)
  unlockCost?: number; // Skill points cost (default 1)
  // Active skill properties
  manaCost?: number;
  cooldown?: number; // In seconds
  target?: SkillTarget;
  effect?: SkillEffect;
  // Passive skill properties
  passiveBonus?: PassiveBonus;
  // Idle skill properties
  experienceFormula?: string; // Formula for experience per action
  resourceNodes?: ResourceNode[]; // Available resource nodes
  recipes?: Recipe[]; // Crafting recipes (for production skills)
  passiveBonuses?: SkillPassiveBonus[]; // Level-based passive bonuses
}

export interface ResourceNode {
  level: number; // Minimum skill level required
  nodeId: string;
  name: string;
  successRate: number; // 0-1, chance of successful gathering
  experienceGain: number;
  resources: ResourceDrop[]; // Items that can be obtained
  timeRequired?: number; // Milliseconds required per action
  unlockRequirements?: Array<{ itemId: string; quantity: number }>; // Items required to unlock this node (for secret unlocks)
}

export interface ResourceDrop {
  itemId: string;
  chance: number; // 0-1
  min?: number;
  max?: number;
  quantity?: number;
}

export interface Recipe {
  recipeId: string;
  name: string;
  level: number; // Minimum skill level required
  ingredients: RecipeIngredient[];
  result: {
    itemId: string;
    quantity: number;
  };
  experienceGain: number;
  timeRequired?: number; // Milliseconds required to craft
  skillPrerequisites?: Array<{
    skillId: string;
    level: number;
  }>; // Additional skills required (beyond the primary skill)
  unlockRequirements?: Array<{
    itemId: string;
    quantity: number;
  }>; // Items required to unlock this recipe (for secret recipes)
}

export interface RecipeIngredient {
  itemId: string;
  quantity: number;
}

// Enchantment system
export interface EnchantmentEffect {
  id: string;
  name: string;
  description: string;
  effectType: 'lifesteal' | 'mana_on_hit' | 'critical_boost' | 'experience_gain' | 'gold_gain' | 'item_find' | 'damage_reduction' | 'mana_cost_reduction' | 'cooldown_reduction' | 'health_regeneration' | 'mana_regeneration';
  value: number; // Effect strength (percentage, flat amount, etc. depending on type)
  stacking?: boolean; // Whether multiple of this effect stack
}

export interface ItemEnchantment {
  enchantmentId: string;
  name: string;
  statBonus?: Partial<Stats>;
  combatStatBonus?: Partial<CombatStats>;
  effects?: EnchantmentEffect[];
  appliedAt: number; // Timestamp when enchantment was applied
  appliedBy?: string; // Enchanter level when applied
}

export interface EnchantmentRecipe {
  id: string;
  enchantmentId: string;
  name: string;
  description: string;
  requiredEnchantingLevel: number;
  materials: Array<{
    itemId: string;
    quantity: number;
  }>;
  skillPrerequisites?: Array<{
    skillId: string;
    level: number;
  }>;
  unlockRequirements?: Array<{
    itemId: string;
    quantity: number;
  }>; // Secret unlock items
  baseSuccessRate?: number; // 0-1, defaults to 0.85
  experienceGain: number;
  goldCost?: number; // Optional gold cost in addition to materials
}

export interface SkillPassiveBonus {
  level: number; // Skill level required
  bonus: {
    statBonus?: Partial<Stats>;
    combatStatBonus?: Partial<CombatStats>;
    goldGeneration?: number; // Multiplier
    itemFindRate?: number; // Multiplier
    experienceBonus?: number; // Multiplier
    [key: string]: any; // Allow other bonus types
  };
}

export interface SkillEffect {
  damage?: {
    base: number;
    scaling?: {
      stat: keyof Stats;
      multiplier: number;
    };
  };
  heal?: {
    base: number;
    scaling?: {
      stat: keyof Stats;
      multiplier: number;
    };
  };
  buffId?: string;
  debuffId?: string;
}

export interface PassiveBonus {
  statBonus?: Partial<Stats>;
  combatStatBonus?: Partial<CombatStats>;
  special?: string; // For unique passive effects
}

// Dungeon/Zone definitions
export interface Dungeon {
  id: string;
  name: string;
  description: string;
  tier: number;
  requiredLevel?: number;
  requiredDungeonId?: string; // Must complete this dungeon first
  monsterPools: MonsterPool[];
  bossPool?: MonsterPool[]; // Boss monsters (spawn every 10 rounds)
  rewards: {
    experienceBonus: number; // Multiplier
    goldBonus: number; // Multiplier
    itemDropRate?: number; // Multiplier
  };
  unlockConditions?: {
    level?: number;
    dungeonId?: string;
  };
  guaranteedBossChest?: boolean; // If true, bosses always drop chests (for endgame dungeons)
}

export interface MonsterPool {
  monsterId: string;
  weight: number; // Relative spawn weight
  minLevel?: number;
  maxLevel?: number;
}

// Status effects (buffs/debuffs)
export interface StatusEffect {
  id: string;
  name: string;
  type: StatusEffectType;
  duration: number; // In seconds, -1 for permanent until removed
  stacks: boolean; // Can stack multiple times
  maxStacks?: number;
  effects: {
    statModifier?: Partial<Stats>;
    combatStatModifier?: Partial<CombatStats>;
    damageOverTime?: number;
    healOverTime?: number;
  };
}

// Idle skill level tracking
export interface IdleSkillLevel {
  skillId: string;
  level: number;
  experience: number;
}

// Character state (player's character)
export interface Character {
  id: string;
  name: string;
  classId: string;
  subclassId?: string; // Subclass ID (e.g., "wizard", "necromancer")
  level: number;
  experience: number;
  experienceToNext: number;
  skillPoints: number;
  baseStats: Stats;
  currentStats: Stats; // Base + equipment + buffs
  combatStats: CombatStats;
  learnedSkills: LearnedSkill[];
  equipment: Equipment;
  statusEffects: ActiveStatusEffect[];
  // Idle skills (separate from combat skills)
  idleSkills?: IdleSkillLevel[];
  skillBar?: string[]; // Array of skill IDs for combat skill bar (max 8)
  consumableBar?: string[]; // Array of item IDs for consumable bar (max 3) - food/potion items
  questProgress?: QuestProgress[]; // Quest progress tracking
  activeMercenaries?: ActiveMercenary[]; // Currently rented mercenaries (max 2)
  activeUpgrades?: ActiveUpgrade[]; // Permanent upgrades (always active)
  consumableUpgrades?: ActiveUpgrade[]; // Active consumable upgrades
  statistics?: GameStatistics; // Game statistics tracking
  completedAchievements?: CompletedAchievement[]; // Completed achievements
  autoSkillSettings?: AutoSkillSetting[]; // Automatic skill usage settings
  autoConsumableSettings?: AutoConsumableSetting[]; // Automatic consumable usage settings
  divinationUnlocks?: string[]; // Array of unlocked divination unlock tree node IDs
  divinationUnlockBonuses?: DivinationUnlockBonuses; // Aggregated bonuses from all unlocked nodes
  itemEnchantments?: Record<string, ItemEnchantment[]>; // Key: "${equipmentSlot}_${itemId}", Value: array of enchantments on that item
  unlockedEnchantments?: string[]; // Array of unlocked enchantment recipe IDs (for secret unlocks)
  chronicle?: ChronicleData; // Chronicle system data (narrative story, titles, choices)
  city?: CityData; // City system data (buildings, guilds, vendors)
}

export interface LearnedSkill {
  skillId: string;
  level: number;
}

export interface Equipment {
  weapon?: string; // Item ID
  offhand?: string;
  helmet?: string;
  chest?: string;
  legs?: string;
  boots?: string;
  gloves?: string;
  ring1?: string;
  ring2?: string;
  amulet?: string;
}

export interface ActiveStatusEffect {
  effectId: string;
  remainingDuration: number;
  stacks: number;
  appliedAt: number; // Timestamp
}

// Inventory
export interface InventoryItem {
  itemId: string;
  quantity: number;
}

export interface Inventory {
  items: InventoryItem[];
  maxSlots: number;
}

// Combat-related types
export interface CombatParticipant {
  id: string;
  name: string;
  isPlayer: boolean;
  stats: CombatStats;
  currentHealth: number;
  currentMana: number;
  statusEffects: ActiveStatusEffect[];
  isAlive: boolean;
}

export interface CombatAction {
  actorId: string;
  targetId?: string;
  type: CombatActionType;
  skillId?: string;
  itemId?: string;
  damage?: number;
  heal?: number;
  manaRestore?: number;
  effects?: string[]; // Status effect IDs applied
  timestamp: number;
}

export interface CombatLog {
  actions: CombatAction[];
  result: CombatResult;
  rewards?: CombatRewards;
  duration: number; // In seconds
}

export interface CombatRewards {
  experience: number;
  gold: number;
  items: Array<{ itemId: string; quantity: number }>;
  chests?: Array<{ itemId: string; quantity: number }>; // Special chests
}

export interface ActiveMonsterState {
  monster: Monster;
  participantId: string; // Unique participant ID from CombatEngine (e.g., "goblin_0", "goblin_1")
  currentHealth: number;
  maxHealth: number;
}

export interface ActivePlayerPartyMember {
  id: string;
  name: string;
  isSummoned: boolean; // true for summoned entities, false for player
  currentHealth: number;
  maxHealth: number;
  currentMana: number;
  maxMana: number;
  level?: number;
}

export interface ActiveCombatState {
  playerParty: ActivePlayerPartyMember[]; // Player + up to 4 summoned entities (max 5 total)
  monsters: ActiveMonsterState[]; // 1-5 monsters per round
  playerHealth: number; // Deprecated: use playerParty[0] instead, kept for backwards compatibility
  playerMaxHealth: number; // Deprecated
  playerMana: number; // Deprecated
  playerMaxMana: number; // Deprecated
  currentActor: 'player' | 'monster' | 'summoned';
  currentPlayerIndex?: number; // Which party member is acting
  currentMonsterIndex: number; // Which monster is currently acting
  recentActions: CombatAction[]; // Last 20 actions
  turnNumber: number;
  roundNumber: number; // Current round (boss every 10 rounds)
  isBossRound: boolean; // Is this a boss round?
  skillCooldowns?: Record<string, number>; // skillId -> timestamp when cooldown ends (milliseconds)
}

// Quest system
// QuestType is now an enum - re-export for backward compatibility
export { QuestType };

export interface Quest {
  id: string;
  name: string;
  description: string;
  type: QuestType;
  requirements: {
    dungeonId?: string; // For dungeon_completion quests
    monsterId?: string; // For monster_kills quests
    itemId?: string; // For item_collection quests
    quantity: number; // Required quantity
  };
  questPrerequisites?: string[]; // Quest IDs that must be completed first
  rewards?: {
    experience?: number;
    gold?: number;
    items?: Array<{ itemId: string; quantity: number }>;
  };
  unlocks?: {
    skills?: string[]; // Skill IDs to unlock
    recipes?: Array<{ skillId: string; recipeId: string }>; // Recipes to unlock
    resourceNodes?: Array<{ skillId: string; nodeId: string }>; // Gathering nodes to unlock
  };
}

export interface QuestProgress {
  questId: string;
  completed: boolean;
  progress: number; // Current count
  required: number; // Target count
}

// Dungeon progress
export interface DungeonProgress {
  dungeonId: string;
  completed: boolean;
  bestTime?: number; // Best completion time in seconds
  timesCompleted: number;
  unlocked: boolean;
}

// Game configuration
export interface GameConfig {
  experience: {
    baseExp: number;
    expMultiplier: number; // Multiplier per level
    expFormula: string; // Formula for calculating exp needed
  };
  combat: {
    baseDamageFormula: string;
    defenseReductionFormula: string;
    criticalDamageMultiplier: number;
    turnTime: number; // Time per turn in milliseconds
    roundDelay?: number; // Delay between combat rounds in milliseconds (default: 2000)
  };
  economy: {
    itemValueMultiplier: number;
    goldDropMultiplier: number;
  };
  idle: {
    maxOfflineHours: number;
    offlineExpRate: number; // Fraction of online exp rate
    offlineGoldRate: number; // Fraction of online gold rate
  };
}

// Active action type - tracks what the player was doing when they went offline
export type ActiveAction =
  | { type: 'combat'; dungeonId: string }
  | { type: 'skill'; skillId: string; nodeId?: string; recipeId?: string }
  | null;

// Save data structure
export interface SaveData {
  version: string;
  character: Character;
  inventory: Inventory;
  dungeonProgress: DungeonProgress[];
  questProgress?: QuestProgress[]; // Quest progress (also stored in character, kept here for backwards compatibility)
  settings: GameSettings;
  lastSaved: number; // Timestamp
  lastOfflineTime?: number; // Timestamp when game was last closed
  currentDungeonId?: string; // Currently selected dungeon
  activeAction?: ActiveAction; // Last active action (combat or skill)
  maxOfflineHours?: number; // Maximum offline hours (default 8, upgradable)
  activeMercenaries?: ActiveMercenary[]; // Currently rented mercenaries
  activeUpgrades?: ActiveUpgrade[]; // Permanent upgrades
  consumableUpgrades?: ActiveUpgrade[]; // Active consumable upgrades
  statistics?: GameStatistics; // Game statistics tracking
  completedAchievements?: CompletedAchievement[]; // Completed achievements
}

export interface GameSettings {
  // Existing settings
  soundEnabled: boolean;
  musicEnabled: boolean;
  autoCombat: boolean;
  combatSpeed: number; // 1-5
  showDamageNumbers: boolean;

  // New audio settings
  soundVolume?: number; // 0-100
  musicVolume?: number; // 0-100

  // New UI settings
  theme?: 'dark' | 'light' | 'auto';
  fontSize?: 'small' | 'medium' | 'large';
  animationsEnabled?: boolean;
  showTooltips?: boolean;

  // New gameplay settings
  confirmItemDrop?: boolean;
  confirmItemSell?: boolean;
  showNotifications?: boolean;
  autoSaveInterval?: number; // in seconds (0 = disabled)

  // Localization
  language?: string; // Language code (e.g., 'en', 'es', 'fr'), defaults to 'en'
}

// City System - Building and Guild management
export type BuildingCategory = 'core' | 'expanded' | 'specialized';

export interface BuildingLevel {
  level: number;
  upgradeCost: {
    gold: number;
    materials?: Array<{ itemId: string; quantity: number }>;
  };
  bonuses: {
    skillMultiplier?: Record<string, number>; // skillId -> multiplier
    craftingSuccessRate?: number;
    resourceYield?: number;
    unlocks?: {
      recipes?: string[];
      vendors?: string[];
      features?: string[];
    };
  };
  description: string; // What this level unlocks
}

export interface Building {
  id: string;
  name: string;
  description: string;
  category: BuildingCategory;
  unlockRequirements: {
    level?: number;
    gold?: number;
    materials?: Array<{ itemId: string; quantity: number }>;
    prerequisiteBuildings?: Array<{ buildingId: string; level: number }>;
    questId?: string; // Optional quest requirement
  };
  maxLevel: number;
  levels: BuildingLevel[]; // Level 1-5 definitions
  associatedGuildId?: string; // If building is a guild hall
  skillGates?: string[]; // Skill IDs that require this building
}

export interface GuildRank {
  rank: number;
  name: string; // e.g., "Apprentice", "Journeyman", "Master"
  requirements: {
    level?: number;
    skillLevels?: Record<string, number>; // skillId -> level
    questsCompleted?: number;
  };
  benefits: {
    experienceMultiplier: number; // Additional multiplier
    vendorDiscount: number; // Percentage discount (0-1)
    unlocks?: {
      items?: string[];
      recipes?: string[];
      quests?: string[];
    };
  };
}

export interface Guild {
  id: string;
  name: string;
  description: string;
  buildingId: string; // Associated guild hall building
  ranks: GuildRank[];
  vendors: string[]; // Vendor IDs
  skillBonuses: Record<string, number>; // skillId -> experience multiplier
  exclusiveItems?: string[]; // Item IDs only available to members
}

export interface Vendor {
  id: string;
  name: string;
  description: string;
  buildingId?: string; // If vendor is in a specific building
  guildId?: string; // If vendor is guild-specific
  items: Array<{
    itemId: string;
    price: number;
    stock?: number; // Optional limited stock
    unlockLevel?: number; // Building level required
    guildRank?: number; // Guild rank required
  }>;
  buybackRate?: number; // Sell price multiplier (0-1)
}

export interface BuildingProgress {
  buildingId: string;
  level: number;
  unlockedAt: number; // Timestamp
}

export interface GuildProgress {
  guildId: string;
  rank: number;
  experience: number; // Guild experience (earned through guild activities)
  experienceToNext: number;
  joinedAt: number; // Timestamp
}

export interface CityData {
  buildings: BuildingProgress[]; // Unlocked buildings with levels
  primaryGuildId?: string; // Currently primary guild
  secondaryGuildIds: string[]; // Secondary guild memberships
  guildProgress: Record<string, GuildProgress>; // guildId -> progress
}

// Chronicle System - Narrative progression
export type ChronicleCategory = 'combat' | 'crafting' | 'exploration' | 'achievement' | 'milestone' | 'choice' | 'general';

export interface ChronicleEntry {
  id: string; // Unique entry ID
  timestamp: number; // When this event occurred
  category: ChronicleCategory;
  title: string; // Short title for the entry
  narrative: string; // The story text
  metadata?: {
    level?: number;
    dungeonId?: string;
    monsterId?: string;
    achievementId?: string;
    skillId?: string;
    itemId?: string;
    questId?: string;
    [key: string]: any; // Allow additional metadata
  };
}

export interface NarrativeChoiceOption {
  id: string;
  text: string;
  description?: string; // Optional description of what this choice means
  consequences?: {
    titleId?: string; // Title to unlock
    statBonus?: Partial<Stats>;
    combatStatBonus?: Partial<CombatStats>;
    narrativePath?: string; // Affects future narrative generation
  };
}

export interface NarrativeChoice {
  id: string;
  scenarioId: string; // Reference to choice scenario definition
  prompt: string; // The question/choice prompt
  options: NarrativeChoiceOption[];
  triggeredAt: number; // Timestamp when choice was presented
  chosenOptionId?: string; // Which option was chosen (if any)
  resolvedAt?: number; // Timestamp when choice was resolved
}

export interface LegendTitle {
  id: string;
  name: string;
  description: string;
  category: 'combat' | 'crafting' | 'exploration' | 'achievement' | 'general';
  requirements: {
    level?: number;
    dungeonCompletions?: number;
    monsterKills?: Record<string, number>; // monsterId -> count
    achievementIds?: string[];
    skillLevels?: Record<string, number>; // skillId -> level
    choicePath?: string; // Requires specific narrative choice
    [key: string]: any; // Allow other requirement types
  };
  bonuses: {
    statBonus?: Partial<Stats>;
    combatStatBonus?: Partial<CombatStats>;
    combatMultiplier?: {
      experience?: number;
      gold?: number;
      itemDropRate?: number;
    };
    skillMultiplier?: {
      experience?: number;
      speed?: number;
      yield?: number;
    };
    inventorySlots?: number;
    [key: string]: any; // Allow other bonus types
  };
  tier?: number; // For progressive titles (1, 2, 3, etc.)
  maxTier?: number; // Maximum tier for this title
}

export interface ChronicleData {
  entries: ChronicleEntry[]; // All story entries (limit to last 1000)
  activeTitleId?: string; // Currently active title
  unlockedTitles: string[]; // Array of unlocked title IDs
  choiceHistory: NarrativeChoice[]; // All choices made
  lastMilestoneLevel: number; // Track last level milestone recorded
  recordedMilestones: string[]; // Array of milestone keys that have been recorded (e.g., "first_dungeon", "level_10")
}

// All types are already exported with their definitions above

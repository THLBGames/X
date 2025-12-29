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
  type: 'attack' | 'heal' | 'buff' | 'debuff';
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
export type ItemType = 'weapon' | 'armor' | 'accessory' | 'consumable' | 'material' | 'quest';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

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
  // Consumable-specific
  consumableEffect?: ConsumableEffect;
}

export type EquipmentSlot =
  | 'weapon'
  | 'offhand'
  | 'helmet'
  | 'chest'
  | 'legs'
  | 'boots'
  | 'gloves'
  | 'ring1'
  | 'ring2'
  | 'amulet';

export interface ConsumableEffect {
  type: 'heal' | 'mana' | 'buff' | 'experience' | 'offlineTime';
  amount?: number;
  buffId?: string;
  duration?: number; // For buffs, in seconds
  offlineTimeHours?: number; // Hours to add to max offline time (for offline time upgrades)
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
export type SkillType = 'active' | 'passive' | 'gathering' | 'production';
export type SkillTarget = 'self' | 'enemy' | 'ally' | 'all_enemies' | 'all_allies';
export type SkillCategory = 'gathering' | 'production' | 'hybrid';

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
}

export interface RecipeIngredient {
  itemId: string;
  quantity: number;
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
  type: 'buff' | 'debuff';
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
  skillBar?: string[]; // Array of skill IDs for combat skill bar (max 10)
  questProgress?: QuestProgress[]; // Quest progress tracking
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
  type: 'attack' | 'skill' | 'item' | 'defend';
  skillId?: string;
  itemId?: string;
  damage?: number;
  heal?: number;
  effects?: string[]; // Status effect IDs applied
  timestamp: number;
}

export interface CombatLog {
  actions: CombatAction[];
  result: 'victory' | 'defeat' | 'ongoing';
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
}

// Quest system
export type QuestType = 'dungeon_completion' | 'monster_kills' | 'item_collection';

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
  rewards?: {
    experience?: number;
    gold?: number;
    items?: Array<{ itemId: string; quantity: number }>;
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
}

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  autoCombat: boolean;
  combatSpeed: number; // 1-5
  showDamageNumbers: boolean;
}

// All types are already exported with their definitions above


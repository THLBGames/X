import type {
  CharacterClass,
  Monster,
  Item,
  Skill,
  Dungeon,
  GameConfig,
  Quest,
} from '@idle-rpg/shared';

type DataCache<T> = Map<string, T>;
type DataCollection<T> = { [key: string]: T };

export class DataLoader {
  private static instance: DataLoader;
  private classesCache: DataCache<CharacterClass> = new Map();
  private monstersCache: DataCache<Monster> = new Map();
  private itemsCache: DataCache<Item> = new Map();
  private skillsCache: DataCache<Skill> = new Map();
  private dungeonsCache: DataCache<Dungeon> = new Map();
  private questsCache: DataCache<Quest> = new Map();
  private configCache: GameConfig | null = null;
  private loaded = false;

  private constructor() {}

  static getInstance(): DataLoader {
    if (!DataLoader.instance) {
      DataLoader.instance = new DataLoader();
    }
    return DataLoader.instance;
  }

  async loadAll(): Promise<void> {
    if (this.loaded) {
      return;
    }

    // Load classes first (skills depend on classes)
    await this.loadClasses();
    
    await Promise.all([
      this.loadMonsters(),
      this.loadItems(),
      this.loadSkills(),
      this.loadDungeons(),
      this.loadQuests(),
      this.loadConfig(),
    ]);

    this.loaded = true;
  }

  private async loadClasses(): Promise<void> {
    // Load base classes from data directory using fetch
    const classIds = ['warrior', 'mage', 'rogue'];
    
    for (const classId of classIds) {
      try {
        const data = await this.loadJsonFile<CharacterClass>(`/data/classes/${classId}.json`);
        if (data && this.validateClass(data)) {
          this.classesCache.set(data.id, data);
        }
      } catch (error) {
        console.warn(`Failed to load class ${classId}:`, error);
      }
    }

    // Load subclasses
    const subclassIds = ['wizard', 'necromancer', 'guardian', 'berserker', 'ranger', 'swashbuckler'];
    
    for (const subclassId of subclassIds) {
      try {
        const data = await this.loadJsonFile<CharacterClass>(`/data/classes/${subclassId}.json`);
        if (data && this.validateClass(data)) {
          this.classesCache.set(data.id, data);
        }
      } catch (error) {
        console.warn(`Failed to load subclass ${subclassId}:`, error);
      }
    }
  }

  private async loadMonsters(): Promise<void> {
    // Load monsters from data directory using fetch
    // List all monster IDs based on files in data/monsters directory
    const monsterIds = [
      'goblin',
      'wolf',
      'skeleton',
      'orc',
      'orc_warrior',
      'spider',
      'zombie',
      'ghost',
      'imp',
      'bandit',
      'troll',
      'ogre',
      'minotaur',
      'dark_mage',
      'goblin_shaman',
      'shadow_stalker',
      'vampire',
      'wraith',
      'giant',
      'dragon_whelp',
      'lich',
      'balrog',
    ];

    for (const monsterId of monsterIds) {
      try {
        const data = await this.loadJsonFile<Monster>(`/data/monsters/${monsterId}.json`);
        if (data && this.validateMonster(data)) {
          this.monstersCache.set(data.id, data);
        }
      } catch (error) {
        console.warn(`Failed to load monster ${monsterId}:`, error);
      }
    }
  }

  private async loadItems(): Promise<void> {
    // Load all items from manifest file
    try {
      const manifest = await this.loadJsonFile<{ items: string[] }>('/data/items/manifest.json');
      
      if (manifest && manifest.items && Array.isArray(manifest.items)) {
        console.log(`Loading ${manifest.items.length} items...`);
        
        // Load items in batches to avoid overwhelming the browser
        const batchSize = 50;
        for (let i = 0; i < manifest.items.length; i += batchSize) {
          const batch = manifest.items.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (itemId) => {
              try {
                await this.loadItem(itemId);
              } catch (error) {
                console.warn(`Failed to load item ${itemId}:`, error);
              }
            })
          );
          
          // Small delay between batches to prevent blocking
          if (i + batchSize < manifest.items.length) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
        
        console.log(`Loaded ${this.itemsCache.size} items`);
      } else {
        console.warn('Items manifest not found or invalid, falling back to on-demand loading');
        // Fallback: load essential shop items
        const shopItemIds = [
          'offline_time_upgrade_8h',
          'offline_time_upgrade_24h',
        ];
        
        for (const itemId of shopItemIds) {
          await this.loadItem(itemId);
        }
      }
    } catch (error) {
      console.warn('Failed to load items manifest, falling back to on-demand loading:', error);
      // Fallback: load essential shop items
      const shopItemIds = [
        'offline_time_upgrade_8h',
        'offline_time_upgrade_24h',
      ];
      
      for (const itemId of shopItemIds) {
        await this.loadItem(itemId);
      }
    }
  }

  private async loadSkills(): Promise<void> {
    // Load skills from data directory using fetch
    // Get all skill IDs from already-loaded class definitions
    const skillIdsSet = new Set<string>();
    
    // Classes should already be loaded, so we can use the cache
    const classIds = ['warrior', 'mage', 'rogue'];
    for (const classId of classIds) {
      const classData = this.classesCache.get(classId);
      if (classData && classData.availableSkills) {
        classData.availableSkills.forEach((skillId) => skillIdsSet.add(skillId));
      }
    }

    // Also load subclasses
    const subclassIds = ['wizard', 'necromancer', 'guardian', 'berserker', 'ranger', 'swashbuckler'];
    for (const subclassId of subclassIds) {
      const subclassData = this.classesCache.get(subclassId);
      if (subclassData && subclassData.availableSkills) {
        subclassData.availableSkills.forEach((skillId) => skillIdsSet.add(skillId));
      }
    }

    // Add all idle skills (these are not in class definitions)
    const idleSkillIds = [
      'mining',
      'fishing',
      'woodcutting',
      'herbalism',
      'hunting',
      'archaeology',
      'quarrying',
      'foraging',
      'treasure_hunting',
      'thieving',
      'trapping',
      'divination',
      'cooking',
      'blacksmithing',
      'alchemy',
      'enchanting',
      'tailoring',
      'leatherworking',
      'jewelcrafting',
      'engineering',
      'runecrafting',
      'farming',
    ];
    idleSkillIds.forEach((skillId) => skillIdsSet.add(skillId));

    // Convert set to array and load all skills
    const skillIds = Array.from(skillIdsSet);
    
    // Load all skills
    const loadPromises = skillIds.map(async (skillId) => {
      try {
        const data = await this.loadJsonFile<Skill>(`/data/skills/${skillId}.json`);
        if (data && this.validateSkill(data)) {
          this.skillsCache.set(data.id, data);
        }
      } catch (error) {
        console.warn(`Failed to load skill ${skillId}:`, error);
      }
    });

    await Promise.all(loadPromises);
  }

  private async loadDungeons(): Promise<void> {
    // Load all dungeons from data directory using fetch
    const dungeonIds = [
      'forest_clearing',
      'goblin_cave',
      'spider_nest',
      'bandit_camp',
      'old_cemetery',
      'orc_encampment',
      'wolf_den',
      'skeleton_crypt',
      'haunted_forest',
      'troll_cave',
      'imp_infestation',
      'zombie_graveyard',
      'dark_catacombs',
      'ogre_stronghold',
      'ghost_manor',
      'minotaur_labyrinth',
      'vampire_coven',
      'dragon_lair',
      'shadow_realm',
      'demon_forge',
      'lich_tower',
      'ancient_ruins',
      'giant_kingdom',
      'balrog_pit',
      'cursed_castle',
      'abyssal_chasm',
      'dragon_roost',
      'undead_citadel',
      'infernal_plains',
      'void_nexus',
      'chaos_realm',
      'titan_arena',
      'eternal_library',
      'storm_peak',
      'underworld_gate',
      'celestial_sanctum',
      'dread_fortress',
      'forsaken_cathedral',
      'world_ender_chamber',
      'godslayer_throne',
    ];
    
    for (const dungeonId of dungeonIds) {
      try {
        const data = await this.loadJsonFile<Dungeon>(`/data/dungeons/${dungeonId}.json`);
        if (data && this.validateDungeon(data)) {
          this.dungeonsCache.set(data.id, data);
        }
      } catch (error) {
        console.warn(`Failed to load dungeon ${dungeonId}:`, error);
      }
    }
  }

  private async loadQuests(): Promise<void> {
    // Load quests from data directory using fetch
    const questIds = [
      'wizard_quest',
      'necromancer_quest',
      'guardian_quest',
      'berserker_quest',
      'ranger_quest',
      'swashbuckler_quest',
    ];
    
    for (const questId of questIds) {
      try {
        const data = await this.loadJsonFile<Quest>(`/data/quests/${questId}.json`);
        if (data && this.validateQuest(data)) {
          this.questsCache.set(data.id, data);
        }
      } catch (error) {
        console.warn(`Failed to load quest ${questId}:`, error);
      }
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const response = await fetch('/data/config/game.json');
      if (response.ok) {
        const data = await response.json();
        this.configCache = data as GameConfig;
      } else {
        throw new Error('Config file not found');
      }
    } catch (error) {
      console.warn('Failed to load game config, using defaults:', error);
      this.configCache = this.getDefaultConfig();
    }
  }

  // Helper method to load a JSON file
  async loadJsonFile<T>(path: string): Promise<T | null> {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        return null;
      }
      // Check if response is actually JSON before parsing
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('application/json')) {
        // Server returned non-JSON (likely HTML 404 page)
        return null;
      }
      return (await response.json()) as T;
    } catch (error) {
      // Only log if it's not a JSON parse error (which we handle above)
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        return null;
      }
      console.error(`Failed to load ${path}:`, error);
      return null;
    }
  }

  // Public methods to load specific entities (for on-demand loading)
  async loadClass(id: string): Promise<CharacterClass | null> {
    if (this.classesCache.has(id)) {
      return this.classesCache.get(id)!;
    }
    const data = await this.loadJsonFile<CharacterClass>(`/data/classes/${id}.json`);
    if (data && this.validateClass(data)) {
      this.classesCache.set(id, data);
      return data;
    }
    return null;
  }

  async loadMonster(id: string): Promise<Monster | null> {
    if (this.monstersCache.has(id)) {
      return this.monstersCache.get(id)!;
    }
    const data = await this.loadJsonFile<Monster>(`/data/monsters/${id}.json`);
    if (data && this.validateMonster(data)) {
      this.monstersCache.set(id, data);
      return data;
    }
    return null;
  }

  async loadItem(id: string): Promise<Item | null> {
    if (this.itemsCache.has(id)) {
      return this.itemsCache.get(id)!;
    }
    const data = await this.loadJsonFile<Item>(`/data/items/${id}.json`);
    if (data && this.validateItem(data)) {
      this.itemsCache.set(id, data);
      return data;
    }
    return null;
  }

  async loadSkill(id: string): Promise<Skill | null> {
    if (this.skillsCache.has(id)) {
      return this.skillsCache.get(id)!;
    }
    const data = await this.loadJsonFile<Skill>(`/data/skills/${id}.json`);
    if (data && this.validateSkill(data)) {
      this.skillsCache.set(id, data);
      return data;
    }
    return null;
  }

  async loadDungeon(id: string): Promise<Dungeon | null> {
    if (this.dungeonsCache.has(id)) {
      return this.dungeonsCache.get(id)!;
    }
    const data = await this.loadJsonFile<Dungeon>(`/data/dungeons/${id}.json`);
    if (data && this.validateDungeon(data)) {
      this.dungeonsCache.set(id, data);
      return data;
    }
    return null;
  }

  // Type-safe accessors (synchronous - returns cached data)
  getClass(id: string): CharacterClass | undefined {
    return this.classesCache.get(id);
  }

  getAllClasses(): CharacterClass[] {
    return Array.from(this.classesCache.values());
  }

  /**
   * Get only base classes (not subclasses)
   */
  getBaseClasses(): CharacterClass[] {
    return Array.from(this.classesCache.values()).filter(
      (cls) => !cls.isSubclass
    );
  }

  /**
   * Get subclass by ID
   */
  getSubclass(id: string): CharacterClass | undefined {
    const subclass = this.classesCache.get(id);
    if (subclass && subclass.isSubclass) {
      return subclass;
    }
    return undefined;
  }

  /**
   * Get all subclasses for a given base class
   */
  getSubclassesForClass(classId: string): CharacterClass[] {
    return Array.from(this.classesCache.values()).filter(
      (cls) => cls.isSubclass && cls.parentClass === classId
    );
  }

  getMonster(id: string): Monster | undefined {
    return this.monstersCache.get(id);
  }

  getAllMonsters(): Monster[] {
    return Array.from(this.monstersCache.values());
  }

  getItem(id: string): Item | undefined {
    return this.itemsCache.get(id);
  }

  getAllItems(): Item[] {
    return Array.from(this.itemsCache.values());
  }

  getSkill(id: string): Skill | undefined {
    return this.skillsCache.get(id);
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skillsCache.values());
  }

  getDungeon(id: string): Dungeon | undefined {
    return this.dungeonsCache.get(id);
  }

  getAllDungeons(): Dungeon[] {
    return Array.from(this.dungeonsCache.values());
  }

  getQuest(id: string): Quest | undefined {
    return this.questsCache.get(id);
  }

  getAllQuests(): Quest[] {
    return Array.from(this.questsCache.values());
  }

  getConfig(): GameConfig {
    if (!this.configCache) {
      return this.getDefaultConfig();
    }
    return this.configCache;
  }

  // Validation methods (basic validation)
  private validateClass(data: any): data is CharacterClass {
    return (
      data &&
      typeof data.id === 'string' &&
      typeof data.name === 'string' &&
      typeof data.description === 'string' &&
      data.baseStats &&
      data.statGrowth &&
      Array.isArray(data.availableSkills)
    );
  }

  private validateMonster(data: any): data is Monster {
    return (
      data &&
      typeof data.id === 'string' &&
      typeof data.name === 'string' &&
      typeof data.tier === 'number' &&
      typeof data.level === 'number' &&
      data.stats &&
      Array.isArray(data.lootTable) &&
      typeof data.experienceReward === 'number' &&
      data.goldReward
    );
  }

  private validateItem(data: any): data is Item {
    return (
      data &&
      typeof data.id === 'string' &&
      typeof data.name === 'string' &&
      typeof data.description === 'string' &&
      typeof data.type === 'string' &&
      typeof data.rarity === 'string' &&
      typeof data.stackable === 'boolean' &&
      typeof data.value === 'number'
    );
  }

  private validateSkill(data: any): data is Skill {
    // Basic validation - allow skills without effect (idle skills)
    return (
      data &&
      typeof data.id === 'string' &&
      typeof data.name === 'string' &&
      typeof data.description === 'string' &&
      typeof data.type === 'string' &&
      typeof data.maxLevel === 'number'
    );
  }

  private validateDungeon(data: any): data is Dungeon {
    return (
      data &&
      typeof data.id === 'string' &&
      typeof data.name === 'string' &&
      typeof data.description === 'string' &&
      typeof data.tier === 'number' &&
      Array.isArray(data.monsterPools) &&
      data.rewards
    );
  }

  private validateQuest(data: any): data is Quest {
    return (
      data &&
      typeof data.id === 'string' &&
      typeof data.name === 'string' &&
      typeof data.description === 'string' &&
      typeof data.type === 'string' &&
      data.requirements &&
      typeof data.requirements.quantity === 'number'
    );
  }

  private getDefaultConfig(): GameConfig {
    return {
      experience: {
        baseExp: 100,
        expMultiplier: 1.15,
        expFormula: 'baseExp * (expMultiplier ^ (level - 1))',
      },
      combat: {
        baseDamageFormula: 'attack * (1 - defense / (defense + 100))',
        defenseReductionFormula: 'damage * (1 - defense / (defense + 100))',
        criticalDamageMultiplier: 1.5,
        turnTime: 1000,
      },
      economy: {
        itemValueMultiplier: 1.0,
        goldDropMultiplier: 1.0,
      },
      idle: {
        maxOfflineHours: 8, // Base minimum - user's actual max comes from character data
        offlineExpRate: 0.5,
        offlineGoldRate: 0.5,
      },
    };
  }

  // Clear cache (useful for development/testing)
  clearCache(): void {
    this.classesCache.clear();
    this.monstersCache.clear();
    this.itemsCache.clear();
    this.skillsCache.clear();
    this.dungeonsCache.clear();
    this.questsCache.clear();
    this.configCache = null;
    this.loaded = false;
  }
}

// Export singleton instance getter
export const getDataLoader = (): DataLoader => DataLoader.getInstance();



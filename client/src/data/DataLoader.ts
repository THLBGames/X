import type {
  CharacterClass,
  Monster,
  Item,
  Skill,
  Dungeon,
  GameConfig,
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
      this.loadConfig(),
    ]);

    this.loaded = true;
  }

  private async loadClasses(): Promise<void> {
    // Load classes from data directory using fetch
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
    // Items will be loaded on-demand or via manifest
    // For now, this is a placeholder
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
    // Load dungeons from data directory using fetch
    const dungeonIds = ['forest_clearing', 'orc_encampment', 'haunted_forest', 'dragon_lair'];
    
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
        maxOfflineHours: 24,
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
    this.configCache = null;
    this.loaded = false;
  }
}

// Export singleton instance getter
export const getDataLoader = (): DataLoader => DataLoader.getInstance();



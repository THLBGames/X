import type {
  CharacterClass,
  Monster,
  Item,
  Skill,
  Dungeon,
  GameConfig,
  Quest,
  Mercenary,
  SkillUpgrade,
  Achievement,
} from '@idle-rpg/shared';
import i18n from '../i18n/config';

type DataCache<T> = Map<string, T>;

export interface PatchNoteVersion {
  version: string;
  date: string;
  categories: {
    added?: string[];
    changed?: string[];
    fixed?: string[];
    removed?: string[];
  };
}

export interface PatchNotes {
  versions: PatchNoteVersion[];
}

export class DataLoader {
  private static instance: DataLoader;
  private classesCache: DataCache<CharacterClass> = new Map();
  private monstersCache: DataCache<Monster> = new Map();
  private itemsCache: DataCache<Item> = new Map();
  private skillsCache: DataCache<Skill> = new Map();
  private dungeonsCache: DataCache<Dungeon> = new Map();
  private questsCache: DataCache<Quest> = new Map();
  private mercenariesCache: DataCache<Mercenary> = new Map();
  private upgradesCache: DataCache<SkillUpgrade> = new Map();
  private achievementsCache: DataCache<Achievement> = new Map();
  private configCache: GameConfig | null = null;
  private patchNotesCache: PatchNotes | null = null;
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
      this.loadMercenaries(),
      this.loadUpgrades(),
      this.loadAchievements(),
      this.loadConfig(),
      this.loadPatchNotes(),
    ]);

    this.loaded = true;
  }

  private async loadClasses(): Promise<void> {
    // Load combined classes.json file
    const combinedData = await this.loadJsonFile<{ 
      version?: string;
      total_classes?: number;
      classes: { [key: string]: CharacterClass };
    }>('/data/classes/classes.json');
    
    if (!combinedData || !combinedData.classes || typeof combinedData.classes !== 'object') {
      throw new Error('Failed to load classes.json - file not found or invalid format');
    }
    
    console.log(`Loading ${Object.keys(combinedData.classes).length} classes from combined file...`);
    
    let loadedCount = 0;
    for (const [classId, classData] of Object.entries(combinedData.classes)) {
      try {
        if (this.validateClass(classData)) {
          this.classesCache.set(classId, classData);
          loadedCount++;
        }
      } catch (error) {
        console.warn(`Failed to validate class ${classId}:`, error);
      }
    }
    
    console.log(`Loaded ${loadedCount} classes from combined file`);
  }

  private async loadMonsters(): Promise<void> {
    // Load combined monsters.json file
    const combinedData = await this.loadJsonFile<{ 
      version?: string;
      total_monsters?: number;
      monsters: { [key: string]: Monster };
    }>('/data/monsters/monsters.json');
    
    if (!combinedData || !combinedData.monsters || typeof combinedData.monsters !== 'object') {
      throw new Error('Failed to load monsters.json - file not found or invalid format');
    }
    
    console.log(`Loading ${Object.keys(combinedData.monsters).length} monsters from combined file...`);
    
    let loadedCount = 0;
    for (const [monsterId, monsterData] of Object.entries(combinedData.monsters)) {
      try {
        if (this.validateMonster(monsterData)) {
          this.monstersCache.set(monsterId, monsterData);
          loadedCount++;
        }
      } catch (error) {
        console.warn(`Failed to validate monster ${monsterId}:`, error);
      }
    }
    
    console.log(`Loaded ${loadedCount} monsters from combined file`);
  }

  private async loadItems(): Promise<void> {
    // Load combined items.json file
    const combinedData = await this.loadJsonFile<{ 
      version?: string;
      total_items?: number;
      items: { [key: string]: Item };
    }>('/data/items/items.json');
    
    if (!combinedData || !combinedData.items || typeof combinedData.items !== 'object') {
      throw new Error('Failed to load items.json - file not found or invalid format');
    }
    
    console.log(`Loading ${Object.keys(combinedData.items).length} items from combined file...`);
    
    let loadedCount = 0;
    for (const [itemId, itemData] of Object.entries(combinedData.items)) {
      try {
        // Remove _source_file metadata if present (it's just for debugging)
        const cleanedItemData = { ...itemData };
        if ('_source_file' in cleanedItemData) {
          delete (cleanedItemData as Record<string, unknown>)._source_file;
        }
        
        if (this.validateItem(cleanedItemData as Item)) {
          this.itemsCache.set(itemId, cleanedItemData as Item);
          loadedCount++;
        }
      } catch (error) {
        console.warn(`Failed to validate item ${itemId}:`, error);
      }
    }
    
    console.log(`Loaded ${loadedCount} items from combined file`);
  }

  private async loadSkills(): Promise<void> {
    // Load combined skills.json file
    const combinedData = await this.loadJsonFile<{ 
      version?: string;
      total_skills?: number;
      skills: { [key: string]: Skill };
    }>('/data/skills/skills.json');
    
    if (!combinedData || !combinedData.skills || typeof combinedData.skills !== 'object') {
      throw new Error('Failed to load skills.json - file not found or invalid format');
    }
    
    console.log(`Loading ${Object.keys(combinedData.skills).length} skills from combined file...`);
    
    let loadedCount = 0;
    for (const [skillId, skillData] of Object.entries(combinedData.skills)) {
      try {
        if (this.validateSkill(skillData)) {
          this.skillsCache.set(skillId, skillData);
          loadedCount++;
        }
      } catch (error) {
        console.warn(`Failed to validate skill ${skillId}:`, error);
      }
    }
    
    console.log(`Loaded ${loadedCount} skills from combined file`);
  }

  private async loadDungeons(): Promise<void> {
    // Load combined dungeons.json file
    const combinedData = await this.loadJsonFile<{ 
      version?: string;
      total_dungeons?: number;
      dungeons: { [key: string]: Dungeon };
    }>('/data/dungeons/dungeons.json');
    
    if (!combinedData || !combinedData.dungeons || typeof combinedData.dungeons !== 'object') {
      throw new Error('Failed to load dungeons.json - file not found or invalid format');
    }
    
    console.log(`Loading ${Object.keys(combinedData.dungeons).length} dungeons from combined file...`);
    
    let loadedCount = 0;
    for (const [dungeonId, dungeonData] of Object.entries(combinedData.dungeons)) {
      try {
        if (this.validateDungeon(dungeonData)) {
          this.dungeonsCache.set(dungeonId, dungeonData);
          loadedCount++;
        }
      } catch (error) {
        console.warn(`Failed to validate dungeon ${dungeonId}:`, error);
      }
    }
    
    console.log(`Loaded ${loadedCount} dungeons from combined file`);
  }

  private async loadQuests(): Promise<void> {
    // Load combined quests.json file
    const combinedData = await this.loadJsonFile<{ 
      version?: string;
      total_quests?: number;
      quests: { [key: string]: Quest };
    }>('/data/quests/quests.json');
    
    if (!combinedData || !combinedData.quests || typeof combinedData.quests !== 'object') {
      throw new Error('Failed to load quests.json - file not found or invalid format');
    }
    
    console.log(`Loading ${Object.keys(combinedData.quests).length} quests from combined file...`);
    
    let loadedCount = 0;
    for (const [questId, questData] of Object.entries(combinedData.quests)) {
      try {
        if (this.validateQuest(questData)) {
          this.questsCache.set(questId, questData);
          loadedCount++;
        }
      } catch (error) {
        console.warn(`Failed to validate quest ${questId}:`, error);
      }
    }
    
    console.log(`Loaded ${loadedCount} quests from combined file`);
  }

  private async loadMercenaries(): Promise<void> {
    // Load combined mercenaries.json file
    const combinedData = await this.loadJsonFile<{ 
      version?: string;
      total_mercenaries?: number;
      mercenaries: { [key: string]: Mercenary };
    }>('/data/mercenaries/mercenaries.json');
    
    if (!combinedData || !combinedData.mercenaries || typeof combinedData.mercenaries !== 'object') {
      throw new Error('Failed to load mercenaries.json - file not found or invalid format');
    }
    
    console.log(`Loading ${Object.keys(combinedData.mercenaries).length} mercenaries from combined file...`);
    
    let loadedCount = 0;
    for (const [mercenaryId, mercenaryData] of Object.entries(combinedData.mercenaries)) {
      try {
        if (this.validateMercenary(mercenaryData)) {
          this.mercenariesCache.set(mercenaryId, mercenaryData);
          loadedCount++;
        }
      } catch (error) {
        console.warn(`Failed to validate mercenary ${mercenaryId}:`, error);
      }
    }
    
    console.log(`Loaded ${loadedCount} mercenaries from combined file`);
  }

  private async loadAchievements(): Promise<void> {
    // Load combined achievements.json file
    const combinedData = await this.loadJsonFile<{ 
      version?: string;
      total_achievements?: number;
      achievements: { [key: string]: Achievement };
    }>('/data/achievements/achievements.json');
    
    if (!combinedData || !combinedData.achievements || typeof combinedData.achievements !== 'object') {
      throw new Error('Failed to load achievements.json - file not found or invalid format');
    }
    
    console.log(`Loading ${Object.keys(combinedData.achievements).length} achievements from combined file...`);
    
    let loadedCount = 0;
    for (const [achievementId, achievementData] of Object.entries(combinedData.achievements)) {
      try {
        if (this.validateAchievement(achievementData)) {
          this.achievementsCache.set(achievementId, achievementData);
          loadedCount++;
        }
      } catch (error) {
        console.warn(`Failed to validate achievement ${achievementId}:`, error);
      }
    }
    
    console.log(`Loaded ${loadedCount} achievements from combined file`);
  }

  private async loadUpgrades(): Promise<void> {
    // Load combined upgrades.json file
    const combinedData = await this.loadJsonFile<{ 
      version?: string;
      total_upgrades?: number;
      upgrades: { [key: string]: SkillUpgrade };
    }>('/data/upgrades/upgrades.json');
    
    if (!combinedData || !combinedData.upgrades || typeof combinedData.upgrades !== 'object') {
      throw new Error('Failed to load upgrades.json - file not found or invalid format');
    }
    
    console.log(`Loading ${Object.keys(combinedData.upgrades).length} upgrades from combined file...`);
    
    let loadedCount = 0;
    for (const [upgradeId, upgradeData] of Object.entries(combinedData.upgrades)) {
      try {
        if (this.validateUpgrade(upgradeData)) {
          this.upgradesCache.set(upgradeId, upgradeData);
          loadedCount++;
        }
      } catch (error) {
        console.warn(`Failed to validate upgrade ${upgradeId}:`, error);
      }
    }
    
    console.log(`Loaded ${loadedCount} upgrades from combined file`);
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

  private async loadPatchNotes(): Promise<void> {
    try {
      const data = await this.loadJsonFile<PatchNotes>('/data/config/patch_notes.json');
      if (data && data.versions && Array.isArray(data.versions)) {
        this.patchNotesCache = data;
        console.log(`Loaded ${data.versions.length} patch note versions`);
      } else {
        console.warn('Failed to load patch notes - invalid format');
        this.patchNotesCache = { versions: [] };
      }
    } catch (error) {
      console.warn('Failed to load patch notes:', error);
      this.patchNotesCache = { versions: [] };
    }
  }

  getPatchNotes(): PatchNotes | null {
    return this.patchNotesCache;
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
    // Check cache first (items should be loaded from combined file via loadAll)
    if (this.itemsCache.has(id)) {
      return this.itemsCache.get(id)!;
    }
    
    // Item not found - should have been loaded from combined file
    if (!this.loaded) {
      console.warn(`Item ${id} not found in cache and loadAll hasn't been called yet`);
    } else {
      console.warn(`Item ${id} not found in cache - not in combined file`);
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

  getMercenary(id: string): Mercenary | undefined {
    return this.mercenariesCache.get(id);
  }

  getAllMercenaries(): Mercenary[] {
    return Array.from(this.mercenariesCache.values());
  }

  getUpgrade(id: string): SkillUpgrade | undefined {
    return this.upgradesCache.get(id);
  }

  getAllUpgrades(): SkillUpgrade[] {
    return Array.from(this.upgradesCache.values());
  }

  getUpgradesForSkill(skillId: string): SkillUpgrade[] {
    return Array.from(this.upgradesCache.values()).filter(
      (upgrade) => upgrade.scope === 'skill' && upgrade.skillId === skillId
    );
  }

  getUpgradesForCategory(category: string): SkillUpgrade[] {
    return Array.from(this.upgradesCache.values()).filter(
      (upgrade) => upgrade.scope === 'category' && upgrade.category === category
    );
  }

  getAchievement(id: string): Achievement | undefined {
    return this.achievementsCache.get(id);
  }

  getAllAchievements(): Achievement[] {
    return Array.from(this.achievementsCache.values());
  }

  getAchievementsByCategory(category: string): Achievement[] {
    return Array.from(this.achievementsCache.values()).filter(
      (achievement) => achievement.category === category
    );
  }

  getConfig(): GameConfig {
    if (!this.configCache) {
      return this.getDefaultConfig();
    }
    return this.configCache;
  }

  /**
   * Get translated name for an entity
   * Falls back to the original name if translation is not available
   */
  getTranslatedName(entity: { name: string; nameKey?: string }): string {
    if (entity.nameKey) {
      const translated = i18n.t(entity.nameKey, { ns: 'gameData' });
      // If translation returns the key itself, fall back to name
      if (translated === entity.nameKey) {
        return entity.name;
      }
      return translated;
    }
    return entity.name;
  }

  /**
   * Get translated description for an entity
   * Falls back to the original description if translation is not available
   */
  getTranslatedDescription(entity: { description: string; descriptionKey?: string }): string {
    if (entity.descriptionKey) {
      const translated = i18n.t(entity.descriptionKey, { ns: 'gameData' });
      // If translation returns the key itself, fall back to description
      if (translated === entity.descriptionKey) {
        return entity.description;
      }
      return translated;
    }
    return entity.description;
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

  private validateMercenary(data: any): data is Mercenary {
    return (
      data &&
      typeof data.id === 'string' &&
      typeof data.name === 'string' &&
      typeof data.description === 'string' &&
      typeof data.type === 'string' &&
      (data.type === 'combat' || data.type === 'skilling') &&
      typeof data.price === 'number' &&
      typeof data.duration === 'number' &&
      (data.type === 'combat' ? data.stats : true) &&
      (data.type === 'skilling' ? data.bonuses : true)
    );
  }

  private validateUpgrade(data: any): data is SkillUpgrade {
    return (
      data &&
      typeof data.id === 'string' &&
      typeof data.name === 'string' &&
      typeof data.description === 'string' &&
      typeof data.type === 'string' &&
      (data.type === 'permanent' || data.type === 'consumable') &&
      typeof data.scope === 'string' &&
      (data.scope === 'skill' || data.scope === 'category') &&
      typeof data.price === 'number' &&
      (data.scope === 'skill' ? typeof data.skillId === 'string' : true) &&
      (data.scope === 'category' ? typeof data.category === 'string' : true) &&
      (data.type === 'permanent' ? typeof data.tier === 'string' : true) &&
      (data.type === 'consumable' ? typeof data.actionDuration === 'number' : true)
    );
  }

  private validateAchievement(data: any): data is Achievement {
    return (
      data &&
      typeof data.id === 'string' &&
      typeof data.name === 'string' &&
      typeof data.description === 'string' &&
      typeof data.category === 'string' &&
      ['combat', 'collection', 'skilling', 'completion', 'milestone'].includes(data.category) &&
      data.requirements &&
      typeof data.requirements === 'object'
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
    this.patchNotesCache = null;
    this.loaded = false;
  }
}

// Export singleton instance getter
export const getDataLoader = (): DataLoader => DataLoader.getInstance();



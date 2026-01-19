import type {
  Character,
  Building,
  BuildingProgress,
  CityData,
  Inventory,
} from '@idle-rpg/shared';
import { getDataLoader } from '@/data';
import { InventoryManager } from '../inventory';

interface BuildingsData {
  version: string;
  buildings: {
    [key: string]: Building;
  };
}

export class CityManager {
  private static buildingsCache: BuildingsData | null = null;

  /**
   * Initialize city data for a new character
   */
  static initializeCity(): CityData {
    return {
      buildings: [
        {
          buildingId: 'town_hall',
          level: 1,
          unlockedAt: Date.now(),
        },
      ],
      primaryGuildId: undefined,
      secondaryGuildIds: [],
      guildProgress: {},
    };
  }

  /**
   * Load buildings data
   */
  private static async loadBuildings(): Promise<BuildingsData> {
    if (this.buildingsCache) {
      return this.buildingsCache;
    }

    try {
      const response = await fetch('/data/city/buildings.json');
      if (!response.ok) {
        throw new Error(`Failed to load buildings: ${response.statusText}`);
      }
      const data = await response.json();
      this.buildingsCache = data;
      return data;
    } catch (error) {
      console.error('Error loading buildings:', error);
      return { version: '1.0.0', buildings: {} };
    }
  }

  /**
   * Get a building definition
   */
  static async getBuilding(buildingId: string): Promise<Building | null> {
    const data = await this.loadBuildings();
    return data.buildings[buildingId] || null;
  }

  /**
   * Get all building definitions
   */
  static async getAllBuildings(): Promise<Building[]> {
    const data = await this.loadBuildings();
    return Object.values(data.buildings);
  }

  /**
   * Get building progress for a character
   */
  static getBuildingProgress(city: CityData, buildingId: string): BuildingProgress | null {
    return city.buildings.find((bp) => bp.buildingId === buildingId) || null;
  }

  /**
   * Get building level for a character
   */
  static getBuildingLevel(city: CityData, buildingId: string): number {
    const progress = this.getBuildingProgress(city, buildingId);
    return progress?.level || 0;
  }

  /**
   * Check if a building can be unlocked
   */
  static async canUnlockBuilding(
    character: Character,
    inventory: Inventory,
    buildingId: string
  ): Promise<{ canUnlock: boolean; reason?: string }> {
    if (!character.city) {
      character.city = this.initializeCity();
    }

    const city = character.city;
    const building = await this.getBuilding(buildingId);

    if (!building) {
      return { canUnlock: false, reason: 'Building not found' };
    }

    // Check if already unlocked
    if (this.getBuildingLevel(city, buildingId) > 0) {
      return { canUnlock: false, reason: 'Building already unlocked' };
    }

    const requirements = building.unlockRequirements;

    // Check level requirement
    if (requirements.level && character.level < requirements.level) {
      return {
        canUnlock: false,
        reason: `Requires level ${requirements.level} (current: ${character.level})`,
      };
    }

    // Check gold requirement
    if (requirements.gold) {
      const gold = InventoryManager.getGold(inventory);
      if (gold < requirements.gold) {
        return {
          canUnlock: false,
          reason: `Requires ${requirements.gold} gold (have: ${gold})`,
        };
      }
    }

    // Check material requirements
    if (requirements.materials) {
      for (const material of requirements.materials) {
        const quantity = InventoryManager.getItemQuantity(inventory, material.itemId);
        if (quantity < material.quantity) {
          const dataLoader = getDataLoader();
          const item = dataLoader.getItem(material.itemId);
          const itemName = item?.name || material.itemId;
          return {
            canUnlock: false,
            reason: `Requires ${material.quantity}x ${itemName} (have: ${quantity})`,
          };
        }
      }
    }

    // Check prerequisite buildings
    if (requirements.prerequisiteBuildings) {
      for (const prereq of requirements.prerequisiteBuildings) {
        const prereqLevel = this.getBuildingLevel(city, prereq.buildingId);
        if (prereqLevel < prereq.level) {
          const prereqBuilding = await this.getBuilding(prereq.buildingId);
          const prereqName = prereqBuilding?.name || prereq.buildingId;
          return {
            canUnlock: false,
            reason: `Requires ${prereqName} level ${prereq.level} (current: ${prereqLevel})`,
          };
        }
      }
    }

    // Check quest requirement
    if (requirements.questId) {
      const completedQuests = character.completedAchievements || [];
      const questCompleted = completedQuests.some((q) => q.achievementId === requirements.questId);
      if (!questCompleted) {
        return {
          canUnlock: false,
          reason: `Requires completing quest: ${requirements.questId}`,
        };
      }
    }

    return { canUnlock: true };
  }

  /**
   * Unlock a building
   */
  static async unlockBuilding(
    character: Character,
    inventory: Inventory,
    buildingId: string
  ): Promise<{ success: boolean; character?: Character; inventory?: Inventory; reason?: string }> {
    if (!character.city) {
      character.city = this.initializeCity();
    }

    const canUnlock = await this.canUnlockBuilding(character, inventory, buildingId);
    if (!canUnlock.canUnlock) {
      return { success: false, reason: canUnlock.reason };
    }

    const building = await this.getBuilding(buildingId);
    if (!building) {
      return { success: false, reason: 'Building not found' };
    }

    const requirements = building.unlockRequirements;
    let newInventory = inventory;

    // Deduct gold
    if (requirements.gold) {
      newInventory = InventoryManager.removeItem(newInventory, 'gold', requirements.gold);
    }

    // Deduct materials
    if (requirements.materials) {
      for (const material of requirements.materials) {
        newInventory = InventoryManager.removeItem(
          newInventory,
          material.itemId,
          material.quantity
        );
      }
    }

    // Add building to city
    const newBuildings = [
      ...character.city.buildings,
      {
        buildingId,
        level: 1,
        unlockedAt: Date.now(),
      },
    ];

    const newCity: CityData = {
      ...character.city,
      buildings: newBuildings,
    };

    const updatedCharacter: Character = {
      ...character,
      city: newCity,
    };

    return {
      success: true,
      character: updatedCharacter,
      inventory: newInventory,
    };
  }

  /**
   * Check if a building can be upgraded
   */
  static async canUpgradeBuilding(
    character: Character,
    inventory: Inventory,
    buildingId: string
  ): Promise<{ canUpgrade: boolean; reason?: string }> {
    if (!character.city) {
      return { canUpgrade: false, reason: 'City not initialized' };
    }

    const city = character.city;
    const building = await this.getBuilding(buildingId);
    if (!building) {
      return { canUpgrade: false, reason: 'Building not found' };
    }

    const currentLevel = this.getBuildingLevel(city, buildingId);
    if (currentLevel === 0) {
      return { canUpgrade: false, reason: 'Building not unlocked' };
    }

    if (currentLevel >= building.maxLevel) {
      return { canUpgrade: false, reason: 'Building at max level' };
    }

    const nextLevel = currentLevel + 1;
    const levelData = building.levels.find((l) => l.level === nextLevel);
    if (!levelData) {
      return { canUpgrade: false, reason: 'Next level data not found' };
    }

    // Check gold requirement
    const gold = InventoryManager.getGold(inventory);
    if (gold < levelData.upgradeCost.gold) {
      return {
        canUpgrade: false,
        reason: `Requires ${levelData.upgradeCost.gold} gold (have: ${gold})`,
      };
    }

    // Check material requirements
    if (levelData.upgradeCost.materials) {
      for (const material of levelData.upgradeCost.materials) {
        const quantity = InventoryManager.getItemQuantity(inventory, material.itemId);
        if (quantity < material.quantity) {
          const dataLoader = getDataLoader();
          const item = dataLoader.getItem(material.itemId);
          const itemName = item?.name || material.itemId;
          return {
            canUpgrade: false,
            reason: `Requires ${material.quantity}x ${itemName} (have: ${quantity})`,
          };
        }
      }
    }

    return { canUpgrade: true };
  }

  /**
   * Upgrade a building
   */
  static async upgradeBuilding(
    character: Character,
    inventory: Inventory,
    buildingId: string
  ): Promise<{ success: boolean; character?: Character; inventory?: Inventory; reason?: string }> {
    if (!character.city) {
      return { success: false, reason: 'City not initialized' };
    }

    const canUpgrade = await this.canUpgradeBuilding(character, inventory, buildingId);
    if (!canUpgrade.canUpgrade) {
      return { success: false, reason: canUpgrade.reason };
    }

    const building = await this.getBuilding(buildingId);
    if (!building) {
      return { success: false, reason: 'Building not found' };
    }

    const city = character.city;
    const currentLevel = this.getBuildingLevel(city, buildingId);
    const nextLevel = currentLevel + 1;
    const levelData = building.levels.find((l) => l.level === nextLevel);
    if (!levelData) {
      return { success: false, reason: 'Next level data not found' };
    }

    let newInventory = inventory;

    // Deduct gold
    if (levelData.upgradeCost.gold > 0) {
      newInventory = InventoryManager.removeItem(newInventory, 'gold', levelData.upgradeCost.gold);
    }

    // Deduct materials
    if (levelData.upgradeCost.materials) {
      for (const material of levelData.upgradeCost.materials) {
        newInventory = InventoryManager.removeItem(
          newInventory,
          material.itemId,
          material.quantity
        );
      }
    }

    // Update building level
    const newBuildings = city.buildings.map((bp) =>
      bp.buildingId === buildingId ? { ...bp, level: nextLevel } : bp
    );

    const newCity: CityData = {
      ...city,
      buildings: newBuildings,
    };

    const updatedCharacter: Character = {
      ...character,
      city: newCity,
    };

    return {
      success: true,
      character: updatedCharacter,
      inventory: newInventory,
    };
  }

  /**
   * Get active building bonuses for a character
   */
  static async getBuildingBonuses(character: Character): Promise<{
    skillMultiplier: Record<string, number>;
    craftingSuccessRate: number;
    resourceYield: number;
  }> {
    if (!character.city) {
      return {
        skillMultiplier: {},
        craftingSuccessRate: 0,
        resourceYield: 0,
      };
    }

    const city = character.city;
    const skillMultiplier: Record<string, number> = {};
    let craftingSuccessRate = 0;
    let resourceYield = 0;

    for (const buildingProgress of city.buildings) {
      const building = await this.getBuilding(buildingProgress.buildingId);
      if (!building) continue;

      const levelData = building.levels.find((l) => l.level === buildingProgress.level);
      if (!levelData) continue;

      const bonuses = levelData.bonuses;

      // Aggregate skill multipliers (multiplicative)
      if (bonuses.skillMultiplier) {
        for (const [skillId, multiplier] of Object.entries(bonuses.skillMultiplier)) {
          skillMultiplier[skillId] = (skillMultiplier[skillId] || 1) * multiplier;
        }
      }

      // Aggregate crafting success rate (additive)
      if (bonuses.craftingSuccessRate) {
        craftingSuccessRate += bonuses.craftingSuccessRate;
      }

      // Aggregate resource yield (multiplicative)
      if (bonuses.resourceYield) {
        resourceYield = (resourceYield || 1) * bonuses.resourceYield;
      }
    }

    return {
      skillMultiplier,
      craftingSuccessRate,
      resourceYield: resourceYield || 1,
    };
  }

  /**
   * Check if a skill requires a building
   */
  static async getSkillBuildingRequirement(
    character: Character,
    skillId: string
  ): Promise<{ required: boolean; buildingId?: string; requiredLevel?: number }> {
    if (!character.city) {
      // Check if skill requires any building
      const buildings = await this.getAllBuildings();
      for (const building of buildings) {
        if (building.skillGates?.includes(skillId)) {
          return {
            required: true,
            buildingId: building.id,
            requiredLevel: 1,
          };
        }
      }
      return { required: false };
    }

    const buildings = await this.getAllBuildings();
    for (const building of buildings) {
      if (building.skillGates?.includes(skillId)) {
        const currentLevel = this.getBuildingLevel(character.city, building.id);
        return {
          required: true,
          buildingId: building.id,
          requiredLevel: 1, // Could be made configurable per skill
        };
      }
    }

    return { required: false };
  }

  /**
   * Get buildings that can be unlocked
   */
  static async getAvailableBuildings(character: Character): Promise<Building[]> {
    if (!character.city) {
      character.city = this.initializeCity();
    }

    const allBuildings = await this.getAllBuildings();
    const city = character.city;
    const available: Building[] = [];

    for (const building of allBuildings) {
      const currentLevel = this.getBuildingLevel(city, building.id);
      if (currentLevel === 0) {
        // Building not unlocked, check if it can be unlocked
        available.push(building);
      }
    }

    return available;
  }

  /**
   * Preload buildings data
   */
  static async preloadData(): Promise<void> {
    await this.loadBuildings();
  }
}

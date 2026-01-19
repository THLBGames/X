import type {
  Character,
  Inventory,
  Item,
  ItemEnchantment,
  EnchantmentRecipe,
  EquipmentSlot,
} from '@idle-rpg/shared';
import { IdleSkillSystem } from './IdleSkillSystem';
import { InventoryManager } from '../inventory';
import { getDataLoader } from '@/data';
import { UpgradeManager } from '../upgrade/UpgradeManager';

export interface EnchantingResult {
  success: boolean;
  character?: Character;
  inventory?: Inventory;
  experience: number;
  reason?: string;
  enchantment?: ItemEnchantment;
}

export class EnchantingSystem {
  /**
   * Get the enchantment key for an item in an equipment slot
   */
  static getEnchantmentKey(equipmentSlot: EquipmentSlot, itemId: string): string {
    return `${equipmentSlot}_${itemId}`;
  }

  /**
   * Get enchantments for an item in a specific equipment slot
   */
  static getItemEnchantments(
    character: Character,
    equipmentSlot: EquipmentSlot,
    itemId: string
  ): ItemEnchantment[] {
    if (!character.itemEnchantments) {
      return [];
    }
    const key = this.getEnchantmentKey(equipmentSlot, itemId);
    return character.itemEnchantments[key] || [];
  }

  /**
   * Get maximum enchantments allowed for an item
   */
  static getMaxEnchantments(item: Item): number {
    if (item.maxEnchantments !== undefined) {
      return item.maxEnchantments;
    }
    if (item.enchantmentSlots !== undefined) {
      return item.enchantmentSlots;
    }
    // Default based on rarity
    const rarityMultiplier: Record<string, number> = {
      common: 1,
      uncommon: 1,
      rare: 2,
      epic: 3,
      legendary: 4,
      mythic: 5,
    };
    return rarityMultiplier[item.rarity] || 1;
  }

  /**
   * Check if an item can be enchanted
   */
  static canEnchantItem(
    character: Character,
    item: Item,
    equipmentSlot?: EquipmentSlot
  ): { canEnchant: boolean; reason?: string } {
    // Check if item is equippable
    if (!item.equipmentSlot) {
      return { canEnchant: false, reason: 'Item is not equippable' };
    }

    // Check if equipment slot matches (if provided)
    if (equipmentSlot && item.equipmentSlot !== equipmentSlot) {
      return { canEnchant: false, reason: 'Item slot mismatch' };
    }

    // Check if item has available enchantment slots
    const maxEnchantments = this.getMaxEnchantments(item);
    if (equipmentSlot) {
      const existingEnchantments = this.getItemEnchantments(
        character,
        equipmentSlot,
        item.id
      );
      if (existingEnchantments.length >= maxEnchantments) {
        return {
          canEnchant: false,
          reason: `Item already has maximum enchantments (${maxEnchantments})`,
        };
      }
    }

    return { canEnchant: true };
  }

  /**
   * Check if an enchantment can be unlocked
   */
  static canUnlockEnchantment(
    character: Character,
    inventory: Inventory,
    recipe: EnchantmentRecipe
  ): { canUnlock: boolean; reason?: string } {
    // Check if already unlocked
    const unlockedEnchantments = character.unlockedEnchantments || [];
    if (unlockedEnchantments.includes(recipe.id)) {
      return { canUnlock: false, reason: 'Enchantment already unlocked' };
    }

    // Check unlock requirements
    if (recipe.unlockRequirements) {
      for (const requirement of recipe.unlockRequirements) {
        const quantity = InventoryManager.getItemQuantity(inventory, requirement.itemId);
        if (quantity < requirement.quantity) {
          const item = getDataLoader().getItem(requirement.itemId);
          const itemName = item?.name || requirement.itemId;
          return {
            canUnlock: false,
            reason: `Need ${requirement.quantity}x ${itemName} to unlock (have ${quantity})`,
          };
        }
      }
    }

    return { canUnlock: true };
  }

  /**
   * Unlock a secret enchantment
   */
  static unlockEnchantment(
    character: Character,
    inventory: Inventory,
    recipeId: string
  ): { success: boolean; character?: Character; inventory?: Inventory; reason?: string } {
    const dataLoader = getDataLoader();
    const recipe = dataLoader.getEnchantmentRecipe(recipeId);

    if (!recipe) {
      return { success: false, reason: 'Enchantment recipe not found' };
    }

    const canUnlock = this.canUnlockEnchantment(character, inventory, recipe);
    if (!canUnlock.canUnlock) {
      return { success: false, reason: canUnlock.reason };
    }

    // Consume unlock requirements
    let newInventory = inventory;
    if (recipe.unlockRequirements) {
      for (const requirement of recipe.unlockRequirements) {
        newInventory = InventoryManager.removeItem(
          newInventory,
          requirement.itemId,
          requirement.quantity
        );
      }
    }

    // Add to unlocked enchantments
    const unlockedEnchantments = character.unlockedEnchantments || [];
    const newUnlockedEnchantments = [...unlockedEnchantments, recipeId];

    return {
      success: true,
      character: {
        ...character,
        unlockedEnchantments: newUnlockedEnchantments,
      },
      inventory: newInventory,
    };
  }

  /**
   * Get available enchantments based on skill level and unlocks
   */
  static getAvailableEnchantments(
    character: Character,
    _inventory?: Inventory
  ): EnchantmentRecipe[] {
    const dataLoader = getDataLoader();
    const enchantingLevel = IdleSkillSystem.getSkillLevel(character, 'enchanting');
    const unlockedEnchantments = character.unlockedEnchantments || [];
    const allRecipes = dataLoader.getAllEnchantmentRecipes();

    return allRecipes.filter((recipe) => {
      // Check skill level requirement
      if (enchantingLevel < recipe.requiredEnchantingLevel) {
        return false;
      }

      // Check if it's a secret unlock and if it's unlocked
      if (recipe.unlockRequirements && recipe.unlockRequirements.length > 0) {
        if (!unlockedEnchantments.includes(recipe.id)) {
          return false;
        }
      }

      // Check skill prerequisites
      if (recipe.skillPrerequisites) {
        for (const prereq of recipe.skillPrerequisites) {
          const prereqLevel = IdleSkillSystem.getSkillLevel(character, prereq.skillId);
          if (prereqLevel < prereq.level) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Check if a recipe can be crafted with current inventory
   */
  static canCraftEnchantment(
    inventory: Inventory,
    recipe: EnchantmentRecipe,
    _character?: Character
  ): { canCraft: boolean; missingMaterials?: Array<{ itemId: string; required: number; have: number }>; reason?: string } {
    const missingMaterials: Array<{ itemId: string; required: number; have: number }> = [];

    // Check materials
    for (const material of recipe.materials) {
      const have = InventoryManager.getItemQuantity(inventory, material.itemId);
      if (have < material.quantity) {
        missingMaterials.push({
          itemId: material.itemId,
          required: material.quantity,
          have,
        });
      }
    }

    // Check gold cost
    if (recipe.goldCost) {
      const gold = InventoryManager.getGold(inventory);
      if (gold < recipe.goldCost) {
        return {
          canCraft: false,
          missingMaterials,
          reason: `Need ${recipe.goldCost} gold (have ${gold})`,
        };
      }
    }

    return {
      canCraft: missingMaterials.length === 0 && (!recipe.goldCost || InventoryManager.getGold(inventory) >= recipe.goldCost),
      missingMaterials,
    };
  }

  /**
   * Calculate success rate for enchanting
   */
  static calculateSuccessRate(
    character: Character,
    recipe: EnchantmentRecipe,
    _item: Item,
    _equipmentSlot: EquipmentSlot,
    existingEnchantments: ItemEnchantment[]
  ): number {
    const enchantingLevel = IdleSkillSystem.getSkillLevel(character, 'enchanting');
    const baseSuccessRate = recipe.baseSuccessRate || 0.85;

    // Level bonus (up to +30% for being over-leveled)
    const levelBonus = Math.min(enchantingLevel - recipe.requiredEnchantingLevel, 30) * 0.01;

    // Penalty for existing enchantments (-5% per enchantment)
    const enchantmentPenalty = existingEnchantments.length * 0.05;

    // Upgrade bonuses
    const upgradeBonuses = UpgradeManager.getUpgradeBonuses(character, 'enchanting');
    const successRateBonus = upgradeBonuses.successRateBonus || 0;

    // Final success rate (capped at 98%)
    const finalRate = Math.min(
      baseSuccessRate + levelBonus - enchantmentPenalty + successRateBonus,
      0.98
    );

    return Math.max(finalRate, 0.1); // Minimum 10% success rate
  }

  /**
   * Enchant an item
   */
  static enchantItem(
    character: Character,
    inventory: Inventory,
    equipmentSlot: EquipmentSlot,
    item: Item,
    recipeId: string
  ): EnchantingResult {
    const dataLoader = getDataLoader();
    const recipe = dataLoader.getEnchantmentRecipe(recipeId);
    const enchantmentData = dataLoader.getEnchantment(recipe?.enchantmentId || '');

    if (!recipe) {
      return { success: false, experience: 0, reason: 'Enchantment recipe not found' };
    }

    if (!enchantmentData) {
      return { success: false, experience: 0, reason: 'Enchantment data not found' };
    }

    // Check if item can be enchanted
    const canEnchant = this.canEnchantItem(character, item, equipmentSlot);
    if (!canEnchant.canEnchant) {
      return { success: false, experience: 0, reason: canEnchant.reason };
    }

    // Check if recipe is available
    const availableRecipes = this.getAvailableEnchantments(character, inventory);
    if (!availableRecipes.find((r) => r.id === recipeId)) {
      return { success: false, experience: 0, reason: 'Enchantment recipe not available' };
    }

    // Check if can craft
    const canCraft = this.canCraftEnchantment(inventory, recipe, character);
    if (!canCraft.canCraft) {
      return {
        success: false,
        experience: 0,
        reason: canCraft.reason || 'Missing required materials',
      };
    }

    // Get existing enchantments
    const existingEnchantments = this.getItemEnchantments(character, equipmentSlot, item.id);

    // Calculate success rate
    const successRate = this.calculateSuccessRate(
      character,
      recipe,
      item,
      equipmentSlot,
      existingEnchantments
    );

    // Determine success
    const success = Math.random() <= successRate;

    // Consume materials (always consume, even on failure - but partial on failure)
    let newInventory = inventory;
    const enchantingLevel = IdleSkillSystem.getSkillLevel(character, 'enchanting');
    
    if (success) {
      // Full consumption on success
      for (const material of recipe.materials) {
        newInventory = InventoryManager.removeItem(
          newInventory,
          material.itemId,
          material.quantity
        );
      }
      if (recipe.goldCost) {
        newInventory = InventoryManager.removeItem(newInventory, 'gold', recipe.goldCost);
      }
    } else {
      // Partial consumption on failure (50-75% random)
      const consumptionRate = 0.5 + Math.random() * 0.25;
      for (const material of recipe.materials) {
        const consumed = Math.max(1, Math.floor(material.quantity * consumptionRate));
        newInventory = InventoryManager.removeItem(newInventory, material.itemId, consumed);
      }
      if (recipe.goldCost) {
        const consumedGold = Math.max(1, Math.floor(recipe.goldCost * consumptionRate));
        newInventory = InventoryManager.removeItem(newInventory, 'gold', consumedGold);
      }
    }

    if (success) {
      // Create enchantment
      const enchantment: ItemEnchantment = {
        enchantmentId: recipe.enchantmentId,
        name: enchantmentData.name,
        statBonus: enchantmentData.statBonus,
        combatStatBonus: enchantmentData.combatStatBonus,
        effects: enchantmentData.effects,
        appliedAt: Date.now(),
        appliedBy: `Level ${enchantingLevel}`,
      };

      // Add enchantment to character
      const itemEnchantments = character.itemEnchantments || {};
      const key = this.getEnchantmentKey(equipmentSlot, item.id);
      const existing = itemEnchantments[key] || [];
      const updated = [...existing, enchantment];

      const newCharacter: Character = {
        ...character,
        itemEnchantments: {
          ...itemEnchantments,
          [key]: updated,
        },
      };

      // Add experience
      const expResult = IdleSkillSystem.addSkillExperience(
        newCharacter,
        'enchanting',
        recipe.experienceGain
      );

      return {
        success: true,
        character: expResult.character,
        inventory: newInventory,
        experience: recipe.experienceGain,
        enchantment,
      };
    } else {
      // Failed - give reduced XP
      const failedExp = Math.floor(recipe.experienceGain * 0.25);
      const expResult = IdleSkillSystem.addSkillExperience(
        character,
        'enchanting',
        failedExp
      );

      return {
        success: false,
        character: expResult.character,
        inventory: newInventory,
        experience: failedExp,
        reason: 'Enchanting failed',
      };
    }
  }

  /**
   * Remove an enchantment from an item
   */
  static removeEnchantment(
    character: Character,
    equipmentSlot: EquipmentSlot,
    itemId: string,
    enchantmentIndex: number
  ): { success: boolean; character?: Character; reason?: string } {
    const itemEnchantments = character.itemEnchantments || {};
    const key = this.getEnchantmentKey(equipmentSlot, itemId);
    const existing = itemEnchantments[key] || [];

    if (enchantmentIndex < 0 || enchantmentIndex >= existing.length) {
      return { success: false, reason: 'Invalid enchantment index' };
    }

    const updated = existing.filter((_, index) => index !== enchantmentIndex);
    const newItemEnchantments = {
      ...itemEnchantments,
      [key]: updated,
    };

    // Remove key if empty
    if (updated.length === 0) {
      delete newItemEnchantments[key];
    }

    return {
      success: true,
      character: {
        ...character,
        itemEnchantments: newItemEnchantments,
      },
    };
  }
}

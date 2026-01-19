import type { Character, Recipe, Inventory } from '@idle-rpg/shared';
import { IdleSkillSystem } from './IdleSkillSystem';
import { InventoryManager } from '../inventory';

export interface CraftingResult {
  success: boolean;
  itemId?: string;
  quantity?: number;
  experience: number;
  reason?: string;
}

export class CraftingSystem {
  /**
   * Attempt to craft an item using a recipe
   */
  static craftItem(
    character: Character,
    inventory: Inventory,
    skillId: string,
    recipe: Recipe
  ): CraftingResult {
    const skillLevel = IdleSkillSystem.getSkillLevel(character, skillId);

    // Check skill level requirement
    if (skillLevel < recipe.level) {
      return {
        success: false,
        experience: 0,
        reason: `Requires skill level ${recipe.level}`,
      };
    }

    // Check skill prerequisites
    if (recipe.skillPrerequisites) {
      for (const prereq of recipe.skillPrerequisites) {
        const prereqLevel = IdleSkillSystem.getSkillLevel(character, prereq.skillId);
        if (prereqLevel < prereq.level) {
          return {
            success: false,
            experience: 0,
            reason: `Requires ${prereq.skillId} level ${prereq.level}`,
          };
        }
      }
    }

    // Check unlock requirements (for secret recipes)
    if (recipe.unlockRequirements) {
      for (const requirement of recipe.unlockRequirements) {
        const quantity = InventoryManager.getItemQuantity(inventory, requirement.itemId);
        if (quantity < requirement.quantity) {
          return {
            success: false,
            experience: 0,
            reason: `Recipe requires ${requirement.quantity}x ${requirement.itemId} to unlock`,
          };
        }
      }
    }

    // Check if player has all ingredients
    for (const ingredient of recipe.ingredients) {
      const quantity = InventoryManager.getItemQuantity(inventory, ingredient.itemId);
      if (quantity < ingredient.quantity) {
        return {
          success: false,
          experience: 0,
          reason: `Missing ${ingredient.itemId}`,
        };
      }
    }

    // Calculate success rate (higher skill = better success)
    const levelBonus = Math.min(skillLevel - recipe.level, 30) * 0.01; // +1% per level, max +30%
    const baseSuccessRate = 0.85; // Base 85% success rate
    const successRate = Math.min(baseSuccessRate + levelBonus, 0.98); // Cap at 98%
    const success = Math.random() <= successRate;

    if (!success) {
      // Failed craft - consume some ingredients (50% chance to lose each)
      return {
        success: false,
        experience: Math.floor(recipe.experienceGain * 0.25), // 25% exp for failed crafts
        reason: 'Crafting failed',
      };
    }

    // Successful craft - consume ingredients
    let newInventory = inventory;
    for (const ingredient of recipe.ingredients) {
      newInventory = InventoryManager.removeItem(newInventory, ingredient.itemId, ingredient.quantity);
    }

    return {
      success: true,
      itemId: recipe.result.itemId,
      quantity: recipe.result.quantity,
      experience: recipe.experienceGain,
    };
  }

  /**
   * Get available recipes for a skill
   */
  static getAvailableRecipes(character: Character, skillId: string, inventory?: Inventory): Recipe[] {
    return IdleSkillSystem.getAvailableRecipes(character, skillId, inventory);
  }

  /**
   * Check if a recipe can be crafted with current inventory
   */
  static canCraftRecipe(inventory: Inventory, recipe: Recipe): {
    canCraft: boolean;
    missingIngredients: Array<{ itemId: string; required: number; have: number }>;
  } {
    const missingIngredients: Array<{ itemId: string; required: number; have: number }> = [];

    for (const ingredient of recipe.ingredients) {
      const have = InventoryManager.getItemQuantity(inventory, ingredient.itemId);
      if (have < ingredient.quantity) {
        missingIngredients.push({
          itemId: ingredient.itemId,
          required: ingredient.quantity,
          have,
        });
      }
    }

    return {
      canCraft: missingIngredients.length === 0,
      missingIngredients,
    };
  }
}


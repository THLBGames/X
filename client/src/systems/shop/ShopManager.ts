import type { Item, Inventory, Character } from '@idle-rpg/shared';
import { getDataLoader } from '@/data';
import { InventoryManager } from '../inventory';

export interface ShopTransactionResult {
  success: boolean;
  message: string;
  newInventory?: Inventory;
  newGold?: number;
  upgradeTier?: string; // For upgrade purchases
  actionDuration?: number; // For consumable activations
}

export class ShopManager {
  private static readonly SELL_PRICE_MULTIPLIER = 0.5; // Sell items for 50% of base value

  /**
   * Get all items available for purchase
   * Filters out gold and items with no value
   */
  static getAvailableItems(): Item[] {
    const dataLoader = getDataLoader();
    const allItems = dataLoader.getAllItems();
    
    return allItems.filter((item) => {
      // Gold cannot be purchased
      if (item.id === 'gold') {
        return false;
      }
      // Only show items with a value > 0
      return item.value > 0;
    });
  }

  /**
   * Get items by category/type
   */
  static getItemsByType(type: string): Item[] {
    return this.getAvailableItems().filter((item) => item.type === type);
  }

  /**
   * Calculate buy price for an item
   * For now, buy price = item base value
   */
  static calculateBuyPrice(item: Item): number {
    return item.value || 0;
  }

  /**
   * Calculate sell price for an item
   * Sell price = item base value * sell multiplier
   */
  static calculateSellPrice(item: Item): number {
    return Math.floor((item.value || 0) * this.SELL_PRICE_MULTIPLIER);
  }

  /**
   * Get current gold amount from inventory
   */
  static getGold(inventory: Inventory): number {
    return InventoryManager.getItemQuantity(inventory, 'gold');
  }

  /**
   * Check if player can afford an item
   */
  static canAfford(inventory: Inventory, item: Item, quantity: number = 1): boolean {
    const gold = this.getGold(inventory);
    const price = this.calculateBuyPrice(item) * quantity;
    return gold >= price;
  }

  /**
   * Purchase an item
   */
  static purchaseItem(
    inventory: Inventory,
    item: Item,
    quantity: number = 1
  ): ShopTransactionResult {
    // Validate item
    if (item.id === 'gold') {
      return {
        success: false,
        message: 'Cannot purchase gold',
      };
    }

    if (item.value <= 0) {
      return {
        success: false,
        message: 'This item cannot be purchased',
      };
    }

    // Check if player can afford
    const price = this.calculateBuyPrice(item) * quantity;
    const gold = this.getGold(inventory);

    if (gold < price) {
      return {
        success: false,
        message: `Not enough gold. Need ${price}, have ${gold}`,
      };
    }

    // Check inventory space (if item is not stackable, need slots)
    // For now, we'll assume there's always space (can be enhanced later)

    // Process transaction
    try {
      // Remove gold
      let newInventory = InventoryManager.removeItem(inventory, 'gold', price);

      // Add item
      newInventory = InventoryManager.addItem(newInventory, item.id, quantity);

      const newGold = this.getGold(newInventory);

      return {
        success: true,
        message: `Purchased ${quantity}x ${item.name}`,
        newInventory,
        newGold,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Purchase failed',
      };
    }
  }

  /**
   * Sell an item
   */
  static sellItem(
    inventory: Inventory,
    item: Item,
    quantity: number = 1
  ): ShopTransactionResult {
    // Validate item
    if (item.id === 'gold') {
      return {
        success: false,
        message: 'Cannot sell gold',
      };
    }

    if (item.value <= 0) {
      return {
        success: false,
        message: 'This item cannot be sold',
      };
    }

    // Check if player has the item
    const currentQuantity = InventoryManager.getItemQuantity(inventory, item.id);
    if (currentQuantity < quantity) {
      return {
        success: false,
        message: `Not enough items. Have ${currentQuantity}, trying to sell ${quantity}`,
      };
    }

    // Calculate sell price
    const sellPrice = this.calculateSellPrice(item) * quantity;

    // Process transaction
    try {
      // Remove item
      let newInventory = InventoryManager.removeItem(inventory, item.id, quantity);

      // Add gold
      newInventory = InventoryManager.addItem(newInventory, 'gold', sellPrice);

      const newGold = this.getGold(newInventory);

      return {
        success: true,
        message: `Sold ${quantity}x ${item.name} for ${sellPrice} gold`,
        newInventory,
        newGold,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Sale failed',
      };
    }
  }

  /**
   * Check if item can be sold (has value and is in inventory)
   */
  static canSell(inventory: Inventory, itemId: string): boolean {
    const dataLoader = getDataLoader();
    const item = dataLoader.getItem(itemId);

    if (!item || item.id === 'gold' || item.value <= 0) {
      return false;
    }

    return InventoryManager.getItemQuantity(inventory, itemId) > 0;
  }

  /**
   * Get items from inventory that can be sold
   */
  static getSellableItems(inventory: Inventory): Array<{ item: Item; quantity: number }> {
    const dataLoader = getDataLoader();
    const sellable: Array<{ item: Item; quantity: number }> = [];

    for (const inventoryItem of inventory.items) {
      if (inventoryItem.itemId === 'gold') {
        continue;
      }

      const item = dataLoader.getItem(inventoryItem.itemId);
      if (item && item.value > 0) {
        sellable.push({
          item,
          quantity: inventoryItem.quantity,
        });
      }
    }

    return sellable;
  }

  /**
   * Check if item meets level/class requirements
   */
  static meetsRequirements(item: Item, character: Character): boolean {
    if (!item.requirements) {
      return true;
    }

    // Check level requirement
    if (item.requirements.level && character.level < item.requirements.level) {
      return false;
    }

    // Check class requirement
    if (item.requirements.class && !item.requirements.class.includes(character.classId)) {
      return false;
    }

    // Check stat requirements
    if (item.requirements.stats) {
      for (const [stat, requiredValue] of Object.entries(item.requirements.stats)) {
        const currentValue = character.currentStats[stat as keyof typeof character.currentStats];
        if (currentValue < requiredValue) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get shop categories
   */
  static getShopCategories(): string[] {
    const items = this.getAvailableItems();
    const categories = new Set<string>();
    
    items.forEach((item) => {
      categories.add(item.type);
    });

    return Array.from(categories).sort();
  }
}


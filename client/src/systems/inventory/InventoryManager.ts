import type { Inventory, InventoryItem, Item, Equipment, EquipmentSlot } from '@idle-rpg/shared';
import { getDataLoader } from '@/data';

export class InventoryManager {
  /**
   * Add item to inventory
   */
  static addItem(inventory: Inventory, itemId: string, quantity: number): Inventory {
    const dataLoader = getDataLoader();
    const item = dataLoader.getItem(itemId);

    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }

    const newInventory = { ...inventory };
    const existingItemIndex = newInventory.items.findIndex((invItem) => invItem.itemId === itemId);

    if (item.stackable) {
      // Stackable item - merge with existing
      if (existingItemIndex !== -1) {
        const existingItem = newInventory.items[existingItemIndex];
        const maxStack = item.maxStack ?? 999999;
        const totalQuantity = existingItem.quantity + quantity;

        if (totalQuantity > maxStack) {
          // Fill current stack, add overflow to new stack
          existingItem.quantity = maxStack;
          const overflow = totalQuantity - maxStack;

          // Try to add overflow if there's space
          if (this.hasSpace(newInventory)) {
            newInventory.items.push({ itemId, quantity: overflow });
          }
        } else {
          existingItem.quantity = totalQuantity;
        }
      } else {
        // New stackable item
        if (this.hasSpace(newInventory)) {
          newInventory.items.push({ itemId, quantity });
        } else {
          throw new Error('Inventory is full');
        }
      }
    } else {
      // Non-stackable item - add separate entries
      if (this.hasSpace(newInventory, quantity)) {
        for (let i = 0; i < quantity; i++) {
          newInventory.items.push({ itemId, quantity: 1 });
        }
      } else {
        throw new Error('Not enough inventory space');
      }
    }

    return newInventory;
  }

  /**
   * Remove item from inventory
   */
  static removeItem(inventory: Inventory, itemId: string, quantity: number): Inventory {
    const newInventory = { ...inventory };
    let remaining = quantity;

    // Remove from last to first (FIFO style)
    for (let i = newInventory.items.length - 1; i >= 0 && remaining > 0; i--) {
      const item = newInventory.items[i];
      if (item.itemId === itemId) {
        if (item.quantity <= remaining) {
          remaining -= item.quantity;
          newInventory.items.splice(i, 1);
        } else {
          item.quantity -= remaining;
          remaining = 0;
        }
      }
    }

    if (remaining > 0) {
      throw new Error(`Not enough items to remove: ${itemId}`);
    }

    return newInventory;
  }

  /**
   * Get gold amount from inventory
   */
  static getGold(inventory: Inventory): number {
    return this.getItemQuantity(inventory, 'gold');
  }

  /**
   * Add gold to inventory
   */
  static addGold(inventory: Inventory, amount: number): Inventory {
    return this.addItem(inventory, 'gold', amount);
  }

  /**
   * Remove gold from inventory
   */
  static removeGold(inventory: Inventory, amount: number): Inventory {
    return this.removeItem(inventory, 'gold', amount);
  }

  /**
   * Check if inventory has enough gold
   */
  static hasGold(inventory: Inventory, amount: number): boolean {
    return this.getGold(inventory) >= amount;
  }

  /**
   * Get item quantity in inventory
   */
  static getItemQuantity(inventory: Inventory, itemId: string): number {
    return inventory.items
      .filter((item) => item.itemId === itemId)
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Check if inventory has space
   */
  static hasSpace(inventory: Inventory, slots: number = 1): boolean {
    const usedSlots = inventory.items.length;
    return usedSlots + slots <= inventory.maxSlots;
  }

  /**
   * Get used inventory slots
   */
  static getUsedSlots(inventory: Inventory): number {
    return inventory.items.length;
  }

  /**
   * Get available inventory slots
   */
  static getAvailableSlots(inventory: Inventory): number {
    return inventory.maxSlots - inventory.items.length;
  }

  /**
   * Check if item can be equipped
   */
  static canEquipItem(itemId: string, equipment: Equipment, characterClassId?: string): boolean {
    const dataLoader = getDataLoader();
    const item = dataLoader.getItem(itemId);

    if (!item) {
      return false;
    }

    if (!item.equipmentSlot) {
      return false; // Not an equipment item
    }

    // Check class requirements
    if (item.requirements?.class && characterClassId) {
      if (!item.requirements.class.includes(characterClassId)) {
        return false;
      }
    }

    // Check stat requirements (would need character stats)
    // For now, just check if slot exists
    return true;
  }

  /**
   * Get equipment slot for item
   */
  static getEquipmentSlot(itemId: string): EquipmentSlot | null {
    const dataLoader = getDataLoader();
    const item = dataLoader.getItem(itemId);

    return item?.equipmentSlot || null;
  }

  /**
   * Compare two items (for tooltip/comparison display)
   */
  static compareItems(itemId1: string, itemId2: string): {
    better: 'item1' | 'item2' | 'equal' | 'incomparable';
    differences: Array<{ stat: string; item1: number; item2: number }>;
  } {
    const dataLoader = getDataLoader();
    const item1 = dataLoader.getItem(itemId1);
    const item2 = dataLoader.getItem(itemId2);

    if (!item1 || !item2) {
      return { better: 'incomparable', differences: [] };
    }

    if (item1.type !== item2.type || item1.equipmentSlot !== item2.equipmentSlot) {
      return { better: 'incomparable', differences: [] };
    }

    const differences: Array<{ stat: string; item1: number; item2: number }> = [];
    let item1Score = 0;
    let item2Score = 0;

    // Compare stat bonuses
    const allStatKeys = new Set([
      ...Object.keys(item1.statBonuses || {}),
      ...Object.keys(item2.statBonuses || {}),
    ]);

    for (const statKey of allStatKeys) {
      const val1 = item1.statBonuses?.[statKey as keyof typeof item1.statBonuses] || 0;
      const val2 = item2.statBonuses?.[statKey as keyof typeof item2.statBonuses] || 0;

      if (val1 !== val2) {
        differences.push({ stat: statKey, item1: val1 as number, item2: val2 as number });
        item1Score += val1 as number;
        item2Score += val2 as number;
      }
    }

    // Compare combat stat bonuses
    const allCombatStatKeys = new Set([
      ...Object.keys(item1.combatStatBonuses || {}),
      ...Object.keys(item2.combatStatBonuses || {}),
    ]);

    for (const statKey of allCombatStatKeys) {
      const val1 = item1.combatStatBonuses?.[statKey as keyof typeof item1.combatStatBonuses] || 0;
      const val2 = item2.combatStatBonuses?.[statKey as keyof typeof item2.combatStatBonuses] || 0;

      if (val1 !== val2) {
        differences.push({ stat: statKey, item1: val1 as number, item2: val2 as number });
        item1Score += val1 as number;
        item2Score += val2 as number;
      }
    }

    // Determine which is better
    if (item1Score > item2Score) {
      return { better: 'item1', differences };
    } else if (item2Score > item1Score) {
      return { better: 'item2', differences };
    } else {
      return { better: 'equal', differences };
    }
  }

  /**
   * Sort inventory items
   */
  static sortInventory(inventory: Inventory, sortBy: 'name' | 'rarity' | 'type' = 'name'): Inventory {
    const dataLoader = getDataLoader();
    const newInventory = { ...inventory, items: [...inventory.items] };

    newInventory.items.sort((a, b) => {
      const itemA = dataLoader.getItem(a.itemId);
      const itemB = dataLoader.getItem(b.itemId);

      if (!itemA || !itemB) {
        return 0;
      }

      switch (sortBy) {
        case 'name':
          return itemA.name.localeCompare(itemB.name);
        case 'rarity': {
          const rarityOrder: Record<string, number> = {
            common: 0,
            uncommon: 1,
            rare: 2,
            epic: 3,
            legendary: 4,
            mythic: 5,
          };
          return (
            (rarityOrder[itemB.rarity] || 0) - (rarityOrder[itemA.rarity] || 0) ||
            itemA.name.localeCompare(itemB.name)
          );
        }
        case 'type':
          return (
            itemA.type.localeCompare(itemB.type) || itemA.name.localeCompare(itemB.name)
          );
        default:
          return 0;
      }
    });

    return newInventory;
  }

  /**
   * Get all equipped items
   */
  static getEquippedItems(equipment: Equipment): string[] {
    return Object.values(equipment).filter((itemId) => itemId !== undefined) as string[];
  }
}


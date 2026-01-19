import type {
  Character,
  Vendor,
  Item,
  Inventory,
} from '@idle-rpg/shared';
import { CityManager } from './CityManager';
import { GuildManager } from './GuildManager';
import { InventoryManager } from '../inventory';
import { getDataLoader } from '@/data';

interface VendorsData {
  version: string;
  vendors: {
    [key: string]: Vendor;
  };
}

export class VendorManager {
  private static vendorsCache: VendorsData | null = null;

  /**
   * Load vendors data
   */
  private static async loadVendors(): Promise<VendorsData> {
    if (this.vendorsCache) {
      return this.vendorsCache;
    }

    try {
      const response = await fetch('/data/city/vendors.json');
      if (!response.ok) {
        throw new Error(`Failed to load vendors: ${response.statusText}`);
      }
      const data = await response.json();
      this.vendorsCache = data;
      return data;
    } catch (error) {
      console.error('Error loading vendors:', error);
      return { version: '1.0.0', vendors: {} };
    }
  }

  /**
   * Get a vendor definition
   */
  static async getVendor(vendorId: string): Promise<Vendor | null> {
    const data = await this.loadVendors();
    return data.vendors[vendorId] || null;
  }

  /**
   * Get all vendor definitions
   */
  static async getAllVendors(): Promise<Vendor[]> {
    const data = await this.loadVendors();
    return Object.values(data.vendors);
  }

  /**
   * Get vendors for a building
   */
  static async getVendorsForBuilding(buildingId: string): Promise<Vendor[]> {
    const allVendors = await this.getAllVendors();
    return allVendors.filter((v) => v.buildingId === buildingId);
  }

  /**
   * Get vendors for a guild
   */
  static async getVendorsForGuild(guildId: string): Promise<Vendor[]> {
    const allVendors = await this.getAllVendors();
    return allVendors.filter((v) => v.guildId === guildId);
  }

  /**
   * Get all available vendors for a character
   */
  static async getAvailableVendors(character: Character): Promise<Vendor[]> {
    if (!character.city) {
      return [];
    }

    const allVendors = await this.getAllVendors();
    const available: Vendor[] = [];

    for (const vendor of allVendors) {
      // Check building requirement
      if (vendor.buildingId) {
        const buildingLevel = CityManager.getBuildingLevel(character.city, vendor.buildingId);
        if (buildingLevel === 0) {
          continue; // Building not built
        }
      }

      // Check guild requirement
      if (vendor.guildId) {
        const city = character.city;
        const isMember =
          city.primaryGuildId === vendor.guildId ||
          city.secondaryGuildIds.includes(vendor.guildId);
        if (!isMember) {
          continue; // Not a member of the guild
        }
      }

      available.push(vendor);
    }

    return available;
  }

  /**
   * Get available items from a vendor for a character
   */
  static async getAvailableItems(
    character: Character,
    vendorId: string
  ): Promise<Array<{ item: Item; price: number; available: boolean; reason?: string }>> {
    const vendor = await this.getVendor(vendorId);
    if (!vendor) {
      return [];
    }

    if (!character.city) {
      return [];
    }

    const city = character.city;
    const dataLoader = getDataLoader();
    const guildBonuses = await GuildManager.getGuildBonuses(character);
    const vendorDiscount = vendor.guildId ? guildBonuses.vendorDiscount : 0;

    const availableItems: Array<{
      item: Item;
      price: number;
      available: boolean;
      reason?: string;
    }> = [];

    for (const vendorItem of vendor.items) {
      const item = dataLoader.getItem(vendorItem.itemId);
      if (!item) {
        continue;
      }

      let available = true;
      let reason: string | undefined;

      // Check building level requirement
      if (vendorItem.unlockLevel && vendor.buildingId) {
        const buildingLevel = CityManager.getBuildingLevel(city, vendor.buildingId);
        if (buildingLevel < vendorItem.unlockLevel) {
          available = false;
          reason = `Requires ${vendor.buildingId} level ${vendorItem.unlockLevel}`;
        }
      }

      // Check guild rank requirement
      if (vendorItem.guildRank && vendor.guildId) {
        const guildProgress = GuildManager.getGuildProgress(city, vendor.guildId);
        if (!guildProgress || guildProgress.rank < vendorItem.guildRank) {
          available = false;
          reason = `Requires ${vendor.guildId} rank ${vendorItem.guildRank}`;
        }
      }

      // Calculate price with discount
      let price = vendorItem.price;
      if (vendorDiscount > 0 && vendor.guildId) {
        price = Math.floor(price * (1 - vendorDiscount));
      }

      availableItems.push({
        item,
        price,
        available,
        reason,
      });
    }

    return availableItems;
  }

  /**
   * Purchase an item from a vendor
   */
  static async purchaseFromVendor(
    character: Character,
    inventory: Inventory,
    vendorId: string,
    itemId: string,
    quantity: number = 1
  ): Promise<{
    success: boolean;
    inventory?: Inventory;
    reason?: string;
  }> {
    const vendor = await this.getVendor(vendorId);
    if (!vendor) {
      return { success: false, reason: 'Vendor not found' };
    }

    const vendorItem = vendor.items.find((vi) => vi.itemId === itemId);
    if (!vendorItem) {
      return { success: false, reason: 'Item not available from this vendor' };
    }

    // Check availability
    const availableItems = await this.getAvailableItems(character, vendorId);
    const itemData = availableItems.find((ai) => ai.item.id === itemId);
    if (!itemData || !itemData.available) {
      return {
        success: false,
        reason: itemData?.reason || 'Item not available',
      };
    }

    // Check stock
    if (vendorItem.stock !== undefined) {
      if (vendorItem.stock < quantity) {
        return {
          success: false,
          reason: `Only ${vendorItem.stock} available`,
        };
      }
    }

    // Calculate total price
    const totalPrice = itemData.price * quantity;

    // Check gold
    const gold = InventoryManager.getGold(inventory);
    if (gold < totalPrice) {
      return {
        success: false,
        reason: `Not enough gold. Need ${totalPrice}, have ${gold}`,
      };
    }

    // Deduct gold and add item
    let newInventory = InventoryManager.removeItem(inventory, 'gold', totalPrice);
    newInventory = InventoryManager.addItem(newInventory, itemId, quantity);

    return {
      success: true,
      inventory: newInventory,
    };
  }

  /**
   * Sell an item to a vendor (if buyback enabled)
   */
  static async sellToVendor(
    inventory: Inventory,
    vendorId: string,
    itemId: string,
    quantity: number = 1
  ): Promise<{
    success: boolean;
    inventory?: Inventory;
    goldEarned?: number;
    reason?: string;
  }> {
    const vendor = await this.getVendor(vendorId);
    if (!vendor) {
      return { success: false, reason: 'Vendor not found' };
    }

    if (!vendor.buybackRate || vendor.buybackRate <= 0) {
      return { success: false, reason: 'Vendor does not buy items' };
    }

    const dataLoader = getDataLoader();
    const item = dataLoader.getItem(itemId);
    if (!item) {
      return { success: false, reason: 'Item not found' };
    }

    // Check if player has the item
    const currentQuantity = InventoryManager.getItemQuantity(inventory, itemId);
    if (currentQuantity < quantity) {
      return {
        success: false,
        reason: `Not enough items. Have ${currentQuantity}, trying to sell ${quantity}`,
      };
    }

    // Calculate sell price
    const sellPrice = Math.floor(item.value * vendor.buybackRate * quantity);

    // Remove item and add gold
    let newInventory = InventoryManager.removeItem(inventory, itemId, quantity);
    newInventory = InventoryManager.addItem(newInventory, 'gold', sellPrice);

    return {
      success: true,
      inventory: newInventory,
      goldEarned: sellPrice,
    };
  }

  /**
   * Preload vendors data
   */
  static async preloadData(): Promise<void> {
    await this.loadVendors();
  }
}

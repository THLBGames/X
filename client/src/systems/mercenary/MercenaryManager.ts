import type {
  Character,
  Inventory,
  Mercenary,
  ActiveMercenary,
} from '@idle-rpg/shared';
import type { ShopTransactionResult } from '../shop';
import { getDataLoader } from '@/data';
import { InventoryManager } from '../inventory';

export class MercenaryManager {
  private static readonly MAX_MERCENARIES = 2;

  /**
   * Rent a mercenary
   */
  static rentMercenary(
    inventory: Inventory,
    character: Character,
    mercenaryId: string
  ): ShopTransactionResult {
    const dataLoader = getDataLoader();
    const mercenary = dataLoader.getMercenary(mercenaryId);

    if (!mercenary) {
      return {
        success: false,
        message: 'Mercenary not found',
      };
    }

    // Check if player can rent more mercenaries
    const activeCount = (character.activeMercenaries || []).length;
    if (activeCount >= this.MAX_MERCENARIES) {
      return {
        success: false,
        message: `You can only have ${this.MAX_MERCENARIES} active mercenaries at a time`,
      };
    }

    // Check if player already has this mercenary
    if (character.activeMercenaries?.some((m) => m.mercenaryId === mercenaryId)) {
      return {
        success: false,
        message: 'You already have this mercenary active',
      };
    }

    // Check if player can afford it
    const gold = InventoryManager.getGold(inventory);
    if (gold < mercenary.price) {
      return {
        success: false,
        message: `Not enough gold. Need ${mercenary.price}, have ${gold}`,
      };
    }

    // Deduct gold
    const newInventory = InventoryManager.removeItem(inventory, 'gold', mercenary.price);
    const newGold = InventoryManager.getGold(newInventory);

    return {
      success: true,
      message: `Rented ${mercenary.name} for ${mercenary.price} gold`,
      newInventory,
      newGold,
    };
  }

  /**
   * Get active mercenaries
   */
  static getActiveMercenaries(character: Character): ActiveMercenary[] {
    return character.activeMercenaries || [];
  }

  /**
   * Get active combat mercenaries with full data
   */
  static getCombatMercenaries(character: Character): Mercenary[] {
    const dataLoader = getDataLoader();
    const activeMercenaries = this.getActiveMercenaries(character);
    const combatMercenaries: Mercenary[] = [];

    for (const active of activeMercenaries) {
      const mercenary = dataLoader.getMercenary(active.mercenaryId);
      if (mercenary && mercenary.type === 'combat') {
        combatMercenaries.push(mercenary);
      }
    }

    return combatMercenaries;
  }

  /**
   * Get active skilling mercenaries with full data
   */
  static getSkillingMercenaries(character: Character): Mercenary[] {
    const dataLoader = getDataLoader();
    const activeMercenaries = this.getActiveMercenaries(character);
    const skillingMercenaries: Mercenary[] = [];

    for (const active of activeMercenaries) {
      const mercenary = dataLoader.getMercenary(active.mercenaryId);
      if (mercenary && mercenary.type === 'skilling') {
        skillingMercenaries.push(mercenary);
      }
    }

    return skillingMercenaries;
  }

  /**
   * Consume a battle for a combat mercenary
   */
  static consumeBattle(character: Character, mercenaryId: string): Character {
    const activeMercenaries = [...(character.activeMercenaries || [])];
    const mercenaryIndex = activeMercenaries.findIndex((m) => m.mercenaryId === mercenaryId);

    if (mercenaryIndex === -1) {
      return character;
    }

    const mercenary = activeMercenaries[mercenaryIndex];
    if (mercenary.remainingBattles !== undefined) {
      mercenary.remainingBattles -= 1;

      if (mercenary.remainingBattles <= 0) {
        // Remove expired mercenary
        activeMercenaries.splice(mercenaryIndex, 1);
      }
    }

    return {
      ...character,
      activeMercenaries,
    };
  }

  /**
   * Consume an action for a skilling mercenary
   */
  static consumeAction(character: Character, mercenaryId: string): Character {
    const activeMercenaries = [...(character.activeMercenaries || [])];
    const mercenaryIndex = activeMercenaries.findIndex((m) => m.mercenaryId === mercenaryId);

    if (mercenaryIndex === -1) {
      return character;
    }

    const mercenary = activeMercenaries[mercenaryIndex];
    if (mercenary.remainingActions !== undefined) {
      mercenary.remainingActions -= 1;

      if (mercenary.remainingActions <= 0) {
        // Remove expired mercenary
        activeMercenaries.splice(mercenaryIndex, 1);
      }
    }

    return {
      ...character,
      activeMercenaries,
    };
  }

  /**
   * Remove a mercenary manually
   */
  static removeMercenary(character: Character, mercenaryId: string): Character {
    const activeMercenaries = (character.activeMercenaries || []).filter(
      (m) => m.mercenaryId !== mercenaryId
    );

    return {
      ...character,
      activeMercenaries,
    };
  }

  /**
   * Check if player can rent more mercenaries
   */
  static canRentMore(character: Character): boolean {
    const activeCount = (character.activeMercenaries || []).length;
    return activeCount < this.MAX_MERCENARIES;
  }

  /**
   * Create an ActiveMercenary from a Mercenary
   */
  static createActiveMercenary(mercenary: Mercenary): ActiveMercenary {
    const active: ActiveMercenary = {
      mercenaryId: mercenary.id,
      rentedAt: Date.now(),
    };

    if (mercenary.type === 'combat') {
      active.remainingBattles = mercenary.duration;
    } else {
      active.remainingActions = mercenary.duration;
    }

    return active;
  }
}


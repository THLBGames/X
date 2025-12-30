import type { Character, AutoConsumableSetting, Inventory } from '@idle-rpg/shared';
import { getDataLoader } from '@/data';

/**
 * AutoConsumableManager
 * Handles automatic consumable selection based on configured conditions
 */
export class AutoConsumableManager {
  /**
   * Select an auto-consumable to use based on current combat state
   * Returns the itemId to use, or null if no consumable should be used
   */
  static selectAutoConsumable(
    character: Character,
    inventory: Inventory,
    playerHealth: number,
    playerMaxHealth: number,
    playerMana: number,
    playerMaxMana: number
  ): string | null {
    if (!character.consumableBar || character.consumableBar.length === 0) {
      return null;
    }

    if (!character.autoConsumableSettings || character.autoConsumableSettings.length === 0) {
      return null;
    }

    const dataLoader = getDataLoader();

    // Get all consumables from consumable bar that have auto-use enabled
    const enabledAutoConsumables: Array<{
      itemId: string;
      setting: AutoConsumableSetting;
      priority: number;
    }> = [];

    for (const itemId of character.consumableBar) {
      const setting = character.autoConsumableSettings.find((s) => s.itemId === itemId);
      if (!setting || !setting.enabled || setting.condition === 'never') {
        continue;
      }

      // Get item data
      const item = dataLoader.getItem(itemId);
      if (!item) {
        continue;
      }

      // Check if item is consumable type
      if (item.type !== 'consumable' || !item.consumableEffect) {
        continue;
      }

      // Only allow combat-useful consumables (heal, mana, buff)
      // Exclude: experience, offlineTime, and custom effects (like treasure chests)
      const validCombatEffects = ['heal', 'mana', 'buff'];
      if (!validCombatEffects.includes(item.consumableEffect.type)) {
        continue;
      }

      // Check if player has the item in inventory
      const inventoryItem = inventory.items.find((invItem) => invItem.itemId === itemId);
      if (!inventoryItem || inventoryItem.quantity === 0) {
        continue;
      }

      // Evaluate condition
      if (
        this.evaluateCondition(
          setting,
          playerHealth,
          playerMaxHealth,
          playerMana,
          playerMaxMana
        )
      ) {
        // Use consumable bar position as default priority if not set
        const priority = setting.priority ?? character.consumableBar.indexOf(itemId) + 1;
        enabledAutoConsumables.push({ itemId, setting, priority });
      }
    }

    if (enabledAutoConsumables.length === 0) {
      return null;
    }

    // Sort by priority (lower number = higher priority)
    enabledAutoConsumables.sort((a, b) => a.priority - b.priority);

    // Return the first consumable (highest priority)
    return enabledAutoConsumables[0].itemId;
  }

  /**
   * Evaluate if a condition is met
   */
  private static evaluateCondition(
    setting: AutoConsumableSetting,
    playerHealth: number,
    playerMaxHealth: number,
    playerMana: number,
    playerMaxMana: number
  ): boolean {
    switch (setting.condition) {
      case 'always':
        return true;

      case 'never':
        return false;

      case 'player_health_below':
        if (setting.threshold === undefined) return false;
        const playerHealthPercent = (playerHealth / playerMaxHealth) * 100;
        return playerHealthPercent < setting.threshold;

      case 'player_health_above':
        if (setting.threshold === undefined) return false;
        const playerHealthPercentAbove = (playerHealth / playerMaxHealth) * 100;
        return playerHealthPercentAbove > setting.threshold;

      case 'player_mana_below':
        if (setting.threshold === undefined) return false;
        const playerManaPercent = (playerMana / playerMaxMana) * 100;
        return playerManaPercent < setting.threshold;

      case 'player_mana_above':
        if (setting.threshold === undefined) return false;
        const playerManaPercentAbove = (playerMana / playerMaxMana) * 100;
        return playerManaPercentAbove > setting.threshold;

      default:
        return false;
    }
  }

  /**
   * Get the auto-consumable setting for an item, or create a default one
   */
  static getAutoConsumableSetting(character: Character, itemId: string): AutoConsumableSetting {
    const existing = character.autoConsumableSettings?.find((s) => s.itemId === itemId);
    if (existing) {
      return existing;
    }

    // Default: manual only (never)
    return {
      itemId,
      enabled: false,
      condition: 'never',
      priority:
        character.consumableBar?.indexOf(itemId) !== undefined
          ? character.consumableBar.indexOf(itemId) + 1
          : 1,
    };
  }
}


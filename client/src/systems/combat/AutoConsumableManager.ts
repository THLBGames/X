import type { Character, AutoConsumableSetting, Inventory } from '@idle-rpg/shared';
import { AutoCondition, ConsumableEffectType, VALID_COMBAT_CONSUMABLE_EFFECTS, DEFAULT_PRIORITY, ItemType } from '@idle-rpg/shared';
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
      if (!setting || !setting.enabled || setting.condition === AutoCondition.NEVER) {
        continue;
      }

      // Get item data
      const item = dataLoader.getItem(itemId);
      if (!item) {
        continue;
      }

      // Check if item is consumable type
      if (item.type !== (ItemType.CONSUMABLE as string) || !item.consumableEffect) {
        continue;
      }

      // Only allow combat-useful consumables (heal, mana, buff)
      // Exclude: experience, offlineTime, and custom effects (like treasure chests)
      if (!VALID_COMBAT_CONSUMABLE_EFFECTS.includes(item.consumableEffect.type as ConsumableEffectType)) {
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
      case AutoCondition.ALWAYS:
        return true;

      case AutoCondition.NEVER:
        return false;

      case AutoCondition.PLAYER_HEALTH_BELOW:
        if (setting.threshold === undefined) return false;
        const playerHealthPercent = (playerHealth / playerMaxHealth) * 100;
        return playerHealthPercent < setting.threshold;

      case AutoCondition.PLAYER_HEALTH_ABOVE:
        if (setting.threshold === undefined) return false;
        const playerHealthPercentAbove = (playerHealth / playerMaxHealth) * 100;
        return playerHealthPercentAbove > setting.threshold;

      case AutoCondition.PLAYER_MANA_BELOW:
        if (setting.threshold === undefined) return false;
        const playerManaPercent = (playerMana / playerMaxMana) * 100;
        return playerManaPercent < setting.threshold;

      case AutoCondition.PLAYER_MANA_ABOVE:
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
      condition: AutoCondition.NEVER,
      priority:
        character.consumableBar?.indexOf(itemId) !== undefined
          ? character.consumableBar.indexOf(itemId) + 1
          : DEFAULT_PRIORITY,
    };
  }
}


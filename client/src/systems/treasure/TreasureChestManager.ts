import type { LootEntry, Item, ConsumableEffect } from '@idle-rpg/shared';
import { ConsumableEffectType } from '@idle-rpg/shared';
import { DungeonManager } from '../dungeon/DungeonManager';

/**
 * Default loot table for treasure chests (fallback if item doesn't specify)
 */
const DEFAULT_TREASURE_CHEST_LOOT_TABLE: LootEntry[] = [
  // Gold - always drops
  {
    itemId: 'gold',
    chance: 1,
    min: 50,
    max: 200,
  },
  // Common items
  {
    itemId: 'bread',
    chance: 0.4,
    quantity: 1,
  },
  {
    itemId: 'copper_ore',
    chance: 0.35,
    quantity: 1,
  },
  {
    itemId: 'stone',
    chance: 0.3,
    quantity: 1,
  },
  // Uncommon items
  {
    itemId: 'iron_ore',
    chance: 0.25,
    quantity: 1,
  },
  {
    itemId: 'common_herb',
    chance: 0.25,
    quantity: 1,
  },
  {
    itemId: 'health_potion_small',
    chance: 0.2,
    quantity: 1,
  },
  // Rare items
  {
    itemId: 'mana_potion_small',
    chance: 0.15,
    quantity: 1,
  },
  {
    itemId: 'silver_ore',
    chance: 0.1,
    quantity: 1,
  },
  // Epic items (very rare)
  {
    itemId: 'health_potion_medium',
    chance: 0.05,
    quantity: 1,
  },
];

export interface ChestResult {
  items: Array<{ itemId: string; quantity: number }>;
  gold: number;
}

/**
 * Generate loot from opening a chest item
 * This function works with any item that has a consumableEffect with type 'custom'
 * and an optional lootTable and goldReward configuration.
 * 
 * @param item The chest item to open (must have consumableEffect with type 'custom')
 * @returns The loot generated from the chest
 * @throws Error if the item does not have a custom consumable effect
 * 
 * @example
 * // Item definition with custom loot table:
 * {
 *   "id": "epic_loot_box",
 *   "consumableEffect": {
 *     "type": "custom",
 *     "goldReward": { "min": 500, "max": 1000 },
 *     "lootTable": [
 *       { "itemId": "rare_sword", "chance": 0.1, "quantity": 1 },
 *       { "itemId": "gold", "chance": 1, "min": 500, "max": 1000 }
 *     ]
 *   }
 * }
 */
export function generateChestLoot(item: Item): ChestResult {
  const effect = item.consumableEffect;
  
  if (!effect || (effect.type !== ConsumableEffectType.CUSTOM && effect.type !== 'custom')) {
    throw new Error('Item does not have a custom consumable effect');
  }

  // Use item's loot table if provided, otherwise use default
  const lootTable = effect.lootTable || DEFAULT_TREASURE_CHEST_LOOT_TABLE;
  
  // Generate gold
  let gold = 0;
  if (effect.goldReward) {
    gold = effect.goldReward.min + Math.floor(
      Math.random() * (effect.goldReward.max - effect.goldReward.min + 1)
    );
  } else {
    // Check for gold in loot table (for backward compatibility)
    const goldEntry = lootTable.find(entry => entry.itemId === 'gold');
    if (goldEntry && goldEntry.min !== undefined && goldEntry.max !== undefined) {
      gold = goldEntry.min + Math.floor(Math.random() * (goldEntry.max - goldEntry.min + 1));
    }
  }

  // Generate items (exclude gold from loot table as it's handled separately)
  const itemsLootTable = lootTable.filter(entry => entry.itemId !== 'gold');
  const items = DungeonManager.generateLoot(itemsLootTable);

  return {
    items,
    gold,
  };
}

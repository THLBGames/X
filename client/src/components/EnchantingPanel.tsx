import { useState, useMemo } from 'react';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { EnchantingSystem } from '../systems/skills/EnchantingSystem';
import { IdleSkillSystem } from '../systems/skills/IdleSkillSystem';
import { InventoryManager } from '../systems/inventory';
import { EquipmentSlot } from '@idle-rpg/shared';
import './EnchantingPanel.css';

export default function EnchantingPanel() {
  const character = useGameState((state) => state.character);
  const inventory = useGameState((state) => state.inventory);
  const setCharacter = useGameState((state) => state.setCharacter);
  const setInventory = useGameState((state) => state.setInventory);
  const dataLoader = getDataLoader();

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedEquipmentSlot, setSelectedEquipmentSlot] = useState<EquipmentSlot | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  // Get equippable items from inventory
  const equippableItems = useMemo(() => {
    if (!character) return [];
    return inventory.items
      .filter((invItem) => {
        const item = dataLoader.getItem(invItem.itemId);
        return item && item.equipmentSlot;
      })
      .map((invItem) => {
        const item = dataLoader.getItem(invItem.itemId)!;
        return { item, quantity: invItem.quantity };
      });
  }, [inventory, dataLoader, character]);

  // Get equipped items
  const equippedItems = useMemo(() => {
    if (!character) return [];
    const slots: Array<{ slot: EquipmentSlot; itemId: string }> = [];
    const equipment = character.equipment;
    if (equipment.weapon) slots.push({ slot: EquipmentSlot.WEAPON, itemId: equipment.weapon });
    if (equipment.offhand) slots.push({ slot: EquipmentSlot.OFFHAND, itemId: equipment.offhand });
    if (equipment.helmet) slots.push({ slot: EquipmentSlot.HELMET, itemId: equipment.helmet });
    if (equipment.chest) slots.push({ slot: EquipmentSlot.CHEST, itemId: equipment.chest });
    if (equipment.legs) slots.push({ slot: EquipmentSlot.LEGS, itemId: equipment.legs });
    if (equipment.boots) slots.push({ slot: EquipmentSlot.BOOTS, itemId: equipment.boots });
    if (equipment.gloves) slots.push({ slot: EquipmentSlot.GLOVES, itemId: equipment.gloves });
    if (equipment.ring1) slots.push({ slot: EquipmentSlot.RING1, itemId: equipment.ring1 });
    if (equipment.ring2) slots.push({ slot: EquipmentSlot.RING2, itemId: equipment.ring2 });
    if (equipment.amulet) slots.push({ slot: EquipmentSlot.AMULET, itemId: equipment.amulet });
    return slots.map(({ slot, itemId }) => ({
      slot,
      item: dataLoader.getItem(itemId)!,
      itemId,
      enchantments: EnchantingSystem.getItemEnchantments(character, slot, itemId),
    }));
  }, [character, dataLoader]);

  if (!character) {
    return <div className="enchanting-panel">No character loaded</div>;
  }

  const enchantingLevel = IdleSkillSystem.getSkillLevel(character, 'enchanting');
  const availableRecipes = EnchantingSystem.getAvailableEnchantments(character, inventory);

  const selectedItem = selectedItemId
    ? dataLoader.getItem(selectedItemId)
    : selectedEquipmentSlot
      ? character.equipment[selectedEquipmentSlot]
        ? dataLoader.getItem(character.equipment[selectedEquipmentSlot]!)
        : null
      : null;

  const selectedItemEnchantments = selectedItem && selectedEquipmentSlot
    ? EnchantingSystem.getItemEnchantments(character, selectedEquipmentSlot, selectedItem.id)
    : [];

  const handleSelectItem = (itemId: string, slot: EquipmentSlot | null = null) => {
    setSelectedItemId(slot ? null : itemId);
    setSelectedEquipmentSlot(slot);
    setSelectedRecipeId(null);
  };

  const handleEnchant = () => {
    if (!selectedItem || !selectedRecipeId) return;

    const slot = selectedEquipmentSlot || selectedItem.equipmentSlot || 'weapon';
    const recipe = dataLoader.getEnchantmentRecipe(selectedRecipeId);
    if (!recipe) return;

    const result = EnchantingSystem.enchantItem(
      character,
      inventory,
      slot as EquipmentSlot,
      selectedItem,
      selectedRecipeId
    );

    if (result.success && result.character && result.inventory) {
      setCharacter(result.character);
      setInventory(result.inventory);
      alert(`Enchantment successful! Gained ${result.experience} XP`);
      setSelectedRecipeId(null);
    } else {
      alert(result.reason || 'Enchantment failed');
    }
  };

  const handleUnlock = (recipeId: string) => {
    const result = EnchantingSystem.unlockEnchantment(character, inventory, recipeId);
    if (result.success && result.character && result.inventory) {
      setCharacter(result.character);
      setInventory(result.inventory);
      alert('Enchantment unlocked!');
    } else {
      alert(result.reason || 'Cannot unlock enchantment');
    }
  };

  const selectedRecipe = selectedRecipeId ? dataLoader.getEnchantmentRecipe(selectedRecipeId) : null;
  const canCraft = selectedRecipe && selectedItem
    ? EnchantingSystem.canCraftEnchantment(inventory, selectedRecipe, character)
    : { canCraft: false };

  const successRate = selectedRecipe && selectedItem && selectedEquipmentSlot
    ? EnchantingSystem.calculateSuccessRate(
        character,
        selectedRecipe,
        selectedItem,
        selectedEquipmentSlot,
        selectedItemEnchantments
      )
    : 0;

  return (
    <div className="enchanting-panel">
      <div className="enchanting-header">
        <h2>Enchanting</h2>
        <div className="enchanting-level">
          Level {enchantingLevel}/99
        </div>
      </div>

      <div className="enchanting-content">
        <div className="enchanting-sidebar">
          <div className="items-section">
            <h3>Equipped Items</h3>
            <div className="items-list">
              {equippedItems.map(({ slot, item, itemId, enchantments }) => (
                <div
                  key={slot}
                  className={`item-entry ${selectedEquipmentSlot === slot ? 'selected' : ''}`}
                  onClick={() => handleSelectItem(itemId, slot)}
                >
                  <div className="item-name">{dataLoader.getTranslatedName(item)}</div>
                  <div className="item-slot">{slot}</div>
                  {enchantments.length > 0 && (
                    <div className="enchantment-count">{enchantments.length} enchantment(s)</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="items-section">
            <h3>Inventory Items</h3>
            <div className="items-list">
              {equippableItems.map(({ item, quantity }) => (
                <div
                  key={item.id}
                  className={`item-entry ${selectedItemId === item.id ? 'selected' : ''}`}
                  onClick={() => handleSelectItem(item.id)}
                >
                  <div className="item-name">{dataLoader.getTranslatedName(item)}</div>
                  <div className="item-quantity">x{quantity}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="enchanting-main">
          {selectedItem ? (
            <>
              <div className="selected-item-info">
                <h3>{dataLoader.getTranslatedName(selectedItem)}</h3>
                <div className="item-details">
                  <div>Slot: {selectedItem.equipmentSlot || 'N/A'}</div>
                  <div>Rarity: {selectedItem.rarity}</div>
                  <div>Max Enchantments: {EnchantingSystem.getMaxEnchantments(selectedItem)}</div>
                  {selectedItemEnchantments.length > 0 && (
                    <div className="current-enchantments">
                      <h4>Current Enchantments:</h4>
                      {selectedItemEnchantments.map((ench, idx) => (
                        <div key={idx} className="enchantment-item">
                          {ench.name} (Applied: {ench.appliedBy})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="enchantments-section">
                <h3>Available Enchantments</h3>
                <div className="recipes-list">
                  {availableRecipes.map((recipe) => {
                    const needsUnlock = recipe.unlockRequirements && recipe.unlockRequirements.length > 0;
                    const isUnlocked = character.unlockedEnchantments?.includes(recipe.id);
                    const canUnlock = EnchantingSystem.canUnlockEnchantment(character, inventory, recipe);
                    const canUseRecipe = !needsUnlock || isUnlocked;

                    return (
                      <div
                        key={recipe.id}
                        className={`recipe-entry ${selectedRecipeId === recipe.id ? 'selected' : ''} ${!canUseRecipe ? 'locked' : ''}`}
                        onClick={() => canUseRecipe && setSelectedRecipeId(recipe.id)}
                      >
                        <div className="recipe-header">
                          <div className="recipe-name">{recipe.name}</div>
                          {needsUnlock && (
                            <div className="unlock-badge">
                              {isUnlocked ? 'Unlocked' : 'Secret'}
                            </div>
                          )}
                        </div>
                        <div className="recipe-description">{recipe.description}</div>
                        <div className="recipe-requirements">
                          <div>Required Level: {recipe.requiredEnchantingLevel}</div>
                          {recipe.skillPrerequisites && recipe.skillPrerequisites.map((prereq) => (
                            <div key={prereq.skillId}>
                              Requires {prereq.skillId} level {prereq.level}
                            </div>
                          ))}
                        </div>
                        {needsUnlock && !isUnlocked && canUnlock.canUnlock && (
                          <button
                            className="unlock-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnlock(recipe.id);
                            }}
                          >
                            Unlock
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedRecipe && (
                <div className="enchantment-details">
                  <h3>Enchantment Details</h3>
                  <div className="recipe-info">
                    <div>Materials Required:</div>
                    <ul>
                      {selectedRecipe.materials.map((material, idx) => {
                        const item = dataLoader.getItem(material.itemId);
                        const have = InventoryManager.getItemQuantity(inventory, material.itemId);
                        return (
                          <li key={idx} className={have < material.quantity ? 'insufficient' : ''}>
                            {material.quantity}x {item?.name || material.itemId} (have: {have})
                          </li>
                        );
                      })}
                    </ul>
                    {selectedRecipe.goldCost && (
                      <div>
                        Gold Cost: {selectedRecipe.goldCost} (have: {InventoryManager.getGold(inventory)})
                      </div>
                    )}
                    <div>Experience Gain: {selectedRecipe.experienceGain}</div>
                    <div>Success Rate: {(successRate * 100).toFixed(1)}%</div>
                  </div>
                  <button
                    className="enchant-button"
                    onClick={handleEnchant}
                    disabled={!canCraft.canCraft}
                  >
                    Enchant Item
                  </button>
                  {!canCraft.canCraft && canCraft.reason && (
                    <div className="error-message">{canCraft.reason}</div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="no-selection">Select an item to enchant</div>
          )}
        </div>
      </div>
    </div>
  );
}

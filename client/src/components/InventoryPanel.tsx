import { useState } from 'react';
import { useGameState } from '../systems';
import { CharacterManager } from '../systems/character/CharacterManager';
import { InventoryManager } from '../systems/inventory';
import { ShopManager } from '../systems/shop';
import { getDataLoader } from '../data';
import { audioManager } from '../systems/audio/AudioManager';
import { showNotification } from './NotificationManager';
import TooltipWrapper from './TooltipWrapper';
import ItemContextMenu from './ItemContextMenu';
import SellItemModal from './SellItemModal';
import type { Item, Inventory, ItemType, ConsumableEffectType } from '@idle-rpg/shared';
import { VALID_COMBAT_CONSUMABLE_EFFECTS, MAX_CONSUMABLE_BAR_SLOTS } from '@idle-rpg/shared';
import { UI_MESSAGES } from '../constants/ui';
import './InventoryPanel.css';

export default function InventoryPanel() {
  const character = useGameState((state) => state.character);
  const inventory = useGameState((state) => state.inventory);
  const setCharacter = useGameState((state) => state.setCharacter);
  const setInventory = useGameState((state) => state.setInventory);
  const reorderInventoryItems = useGameState((state) => state.reorderInventoryItems);
  const updateConsumableBar = useGameState((state) => state.updateConsumableBar);
  const setMaxOfflineHours = useGameState((state) => state.setMaxOfflineHours);
  const maxOfflineHours = useGameState((state) => state.maxOfflineHours);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    item: Item;
    index: number;
    position: { x: number; y: number };
  } | null>(null);
  const [sellModalItem, setSellModalItem] = useState<Item | null>(null);
  const [isRightClick, setIsRightClick] = useState(false);

  const dataLoader = getDataLoader();

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);

    if (dragIndex !== dropIndex && dragIndex !== null && !isNaN(dragIndex)) {
      reorderInventoryItems(dragIndex, dropIndex);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleContextMenu = (e: React.MouseEvent, item: Item, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      item,
      index,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const handleEquip = (itemId: string) => {
    if (!character) return;

    try {
      const updatedCharacter = CharacterManager.equipItem(character, itemId);
      setCharacter(updatedCharacter);

      const newInventory = InventoryManager.removeItem(inventory, itemId, 1);
      setInventory(newInventory);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to equip item');
    }
  };

  const handleUse = (itemId: string) => {
    if (!character) return;

    const item = dataLoader.getItem(itemId);
    if (!item || !item.consumableEffect) return;

    const effect = item.consumableEffect;

    let updatedCharacter = { ...character };

    // Apply effect based on type
    if (effect.type === ConsumableEffectType.HEAL && effect.amount) {
      updatedCharacter.combatStats = {
        ...updatedCharacter.combatStats,
        health: Math.min(
          updatedCharacter.combatStats.health + effect.amount,
          updatedCharacter.combatStats.maxHealth
        ),
      };
      audioManager.playSound('/audio/sfx/heal.mp3', 0.6);
    } else if (effect.type === ConsumableEffectType.MANA && effect.amount) {
      updatedCharacter.combatStats = {
        ...updatedCharacter.combatStats,
        mana: Math.min(
          updatedCharacter.combatStats.mana + effect.amount,
          updatedCharacter.combatStats.maxMana
        ),
      };
      audioManager.playSound('/audio/sfx/mana_restore.mp3', 0.6);
    } else if (effect.type === ConsumableEffectType.EXPERIENCE && effect.amount) {
      // Add experience using CharacterManager
      const result = CharacterManager.addExperience(updatedCharacter, effect.amount);
      updatedCharacter = result.character;

      // Show notification if level-up occurred
      if (result.leveledUp) {
        if (result.levelsGained === 1) {
          showNotification(
            UI_MESSAGES.LEVEL_UP(updatedCharacter.level),
            'level-up',
            5000
          );
        } else {
          showNotification(
            UI_MESSAGES.LEVEL_UP_MULTIPLE(result.levelsGained, updatedCharacter.level),
            'level-up',
            5000
          );
        }
        audioManager.playSound('/audio/sfx/level_up.mp3', 0.8);
      } else {
        showNotification(UI_MESSAGES.GAINED_EXPERIENCE(effect.amount), 'success', 3000);
        audioManager.playSound('/audio/sfx/experience.mp3', 0.5);
      }
    } else if (effect.type === 'offlineTime') {
      // Increase max offline hours permanently
      const hoursToAdd = effect.offlineTimeHours || 0;
      if (hoursToAdd > 0) {
        const newMaxHours = maxOfflineHours + hoursToAdd;
        setMaxOfflineHours(newMaxHours);
        showNotification(
          UI_MESSAGES.OFFLINE_TIME_INCREASED(hoursToAdd, newMaxHours),
          'success',
          5000
        );
        audioManager.playSound('/audio/sfx/upgrade.mp3', 0.6);
      }
    } else if (effect.type === ConsumableEffectType.BUFF && effect.buffId) {
      // Apply buff (would need buff system implementation)
      // For now, just show a notification
      showNotification(UI_MESSAGES.BUFF_APPLIED(effect.buffId), 'info', 3000);
      audioManager.playSound('/audio/sfx/buff.mp3', 0.6);
    }

    setCharacter(updatedCharacter);

    // Remove item from inventory after all effects
    const newInventory = InventoryManager.removeItem(inventory, itemId, 1);
    setInventory(newInventory);
  };

  const handleSell = (itemId: string, quantity?: number) => {
    const item = dataLoader.getItem(itemId);
    if (!item) return;

    const sellQty = quantity || 1;
    const result = ShopManager.sellItem(inventory, item, sellQty);
    if (result.success && result.newInventory) {
      setInventory(result.newInventory);
    } else {
      alert(result.message);
    }
  };

  const handleItemClick = (_e: React.MouseEvent, itemId: string) => {
    // Don't handle click if it was a right-click (context menu was shown)
    if (isRightClick) {
      setIsRightClick(false);
      return;
    }

    const item = dataLoader.getItem(itemId);
    if (!item) return;

    // Check if item can be sold
    if (ShopManager.canSell(inventory, itemId)) {
      setSellModalItem(item);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Detect right-click
    if (e.button === 2) {
      setIsRightClick(true);
    }
  };

  const handleSellFromModal = (newInventory: Inventory) => {
    setInventory(newInventory);
    setSellModalItem(null);
  };

  const handleDropItem = (itemId: string) => {
    const newInventory = InventoryManager.removeItem(inventory, itemId, 1);
    setInventory(newInventory);
  };

  const handleViewDetails = (itemId: string) => {
    // For now, just show an alert with item details
    const item = dataLoader.getItem(itemId);
    if (item) {
      alert(`${item.name}\n\n${item.description}`);
    }
  };

  const handleEquipToConsumableBar = (itemId: string) => {
    if (!character) return;

    const item = dataLoader.getItem(itemId);
    if (!item || item.type !== (ItemType.CONSUMABLE as string) || !item.consumableEffect) {
      alert(UI_MESSAGES.ITEM_CANNOT_EQUIP_CONSUMABLE_BAR);
      return;
    }

    // Only allow combat-useful consumables (heal, mana, buff)
    // Exclude: experience, offlineTime, and custom effects (like treasure chests)
    const effect = item.consumableEffect;
    if (!VALID_COMBAT_CONSUMABLE_EFFECTS.includes(effect.type as ConsumableEffectType)) {
      alert(UI_MESSAGES.ONLY_COMBAT_CONSUMABLES);
      return;
    }

    const currentConsumableBar = character.consumableBar || [];
    
    // Check if item is already in the bar
    if (currentConsumableBar.includes(itemId)) {
      // Remove from bar
      updateConsumableBar(currentConsumableBar.filter((id) => id !== itemId));
      showNotification(UI_MESSAGES.ITEM_REMOVED_FROM_CONSUMABLE_BAR(item.name), 'info', 3000);
    } else if (currentConsumableBar.length >= MAX_CONSUMABLE_BAR_SLOTS) {
      alert(UI_MESSAGES.CONSUMABLE_BAR_FULL(MAX_CONSUMABLE_BAR_SLOTS));
    } else {
      // Add to bar
      updateConsumableBar([...currentConsumableBar, itemId]);
      showNotification(UI_MESSAGES.ITEM_ADDED_TO_CONSUMABLE_BAR(item.name), 'success', 3000);
    }
  };

  return (
    <div className="inventory-panel">
      <h2>Inventory</h2>
      <div className="inventory-slots">
        Slots: {inventory.items.length} / {inventory.maxSlots}
      </div>
      <div className="inventory-items">
        {inventory.items.length === 0 ? (
          <div className="no-items">Inventory is empty</div>
        ) : (
          inventory.items.map((item, index) => {
            const itemData = dataLoader.getItem(item.itemId);
            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;

            return (
              <div
                key={index}
                className={`inventory-item ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${itemData && ShopManager.canSell(inventory, itemData.id) ? 'sellable' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                onMouseDown={handleMouseDown}
                onClick={(e) => {
                  if (itemData) {
                    handleItemClick(e, itemData.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsRightClick(true);
                  if (itemData) {
                    handleContextMenu(e, itemData, index);
                  }
                }}
              >
                <TooltipWrapper
                  content={
                    itemData
                      ? `${itemData.name}\n${itemData.description || 'No description'}\n${itemData.type ? `Type: ${itemData.type}` : ''}${itemData.rarity ? `\nRarity: ${itemData.rarity}` : ''}`
                      : item.itemId
                  }
                >
                  <div className="item-name">{itemData?.name || item.itemId}</div>
                </TooltipWrapper>
                <div className="item-quantity">x{item.quantity}</div>
                {itemData?.rarity && (
                  <div className={`item-rarity ${itemData.rarity}`}>{itemData.rarity}</div>
                )}
              </div>
            );
          })
        )}
      </div>
      {contextMenu && (
        <ItemContextMenu
          item={contextMenu.item}
          inventoryIndex={contextMenu.index}
          inventory={inventory}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onEquip={handleEquip}
          onUse={handleUse}
          onSell={handleSell}
          onDrop={handleDropItem}
          onViewDetails={handleViewDetails}
          onEquipToConsumableBar={handleEquipToConsumableBar}
        />
      )}
      {sellModalItem && (
        <SellItemModal
          item={sellModalItem}
          inventory={inventory}
          onClose={() => setSellModalItem(null)}
          onSell={handleSellFromModal}
        />
      )}
    </div>
  );
}

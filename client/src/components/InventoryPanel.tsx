import { useState } from 'react';
import { useGameState } from '../systems';
import { CharacterManager } from '../systems/character/CharacterManager';
import { InventoryManager } from '../systems/inventory';
import { ShopManager } from '../systems/shop';
import { getDataLoader } from '../data';
import ItemContextMenu from './ItemContextMenu';
import SellItemModal from './SellItemModal';
import type { Item, Inventory } from '@idle-rpg/shared';
import './InventoryPanel.css';

export default function InventoryPanel() {
  const character = useGameState((state) => state.character);
  const inventory = useGameState((state) => state.inventory);
  const setCharacter = useGameState((state) => state.setCharacter);
  const setInventory = useGameState((state) => state.setInventory);
  const reorderInventoryItems = useGameState((state) => state.reorderInventoryItems);
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

    const updatedCharacter = { ...character };

    // Apply effect based on type
    if (effect.type === 'heal' && effect.amount) {
      updatedCharacter.combatStats = {
        ...updatedCharacter.combatStats,
        health: Math.min(
          updatedCharacter.combatStats.health + effect.amount,
          updatedCharacter.combatStats.maxHealth
        ),
      };
    } else if (effect.type === 'mana' && effect.amount) {
      updatedCharacter.combatStats = {
        ...updatedCharacter.combatStats,
        mana: Math.min(
          updatedCharacter.combatStats.mana + effect.amount,
          updatedCharacter.combatStats.maxMana
        ),
      };
    } else if (effect.type === 'experience' && effect.amount) {
      // Add experience (this would need more complex logic)
      // For now, just remove the item
    } else if (effect.type === 'offlineTime') {
      // Increase max offline hours permanently
      const hoursToAdd = effect.offlineTimeHours || 0;
      if (hoursToAdd > 0) {
        setMaxOfflineHours(maxOfflineHours + hoursToAdd);
        setCharacter(updatedCharacter);
        const newInventory = InventoryManager.removeItem(inventory, itemId, 1);
        setInventory(newInventory);
        alert(
          `Maximum offline time increased by ${hoursToAdd} hours! New max: ${maxOfflineHours + hoursToAdd} hours`
        );
        return; // Early return since we already handled inventory
      }
    } else if (effect.type === 'buff' && effect.buffId) {
      // Apply buff (would need buff system implementation)
      // For now, just remove the item
    }

    setCharacter(updatedCharacter);

    // Remove item from inventory
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
                <div className="item-name">{itemData?.name || item.itemId}</div>
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

import { useState } from 'react';
import { useGameState } from '../systems';
import { CharacterManager } from '../systems/character/CharacterManager';
import { InventoryManager } from '../systems/inventory';
import { ShopManager } from '../systems/shop';
import { getDataLoader } from '../data';
import { audioManager } from '../systems/audio/AudioManager';
import TooltipWrapper from './TooltipWrapper';
import ItemContextMenu from './ItemContextMenu';
import type { EquipmentSlot, Item } from '@idle-rpg/shared';
import './EquipmentPanel.css';

interface EquipmentPanelProps {
  onItemClick?: (itemId: string) => void;
}

export default function EquipmentPanel({ onItemClick: _onItemClick }: EquipmentPanelProps) {
  const character = useGameState((state) => state.character);
  const inventory = useGameState((state) => state.inventory);
  const setCharacter = useGameState((state) => state.setCharacter);
  const setInventory = useGameState((state) => state.setInventory);
  const addItem = useGameState((state) => state.addItem);

  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    item: Item;
    slot: EquipmentSlot;
    position: { x: number; y: number };
  } | null>(null);

  if (!character) {
    return null;
  }

  const dataLoader = getDataLoader();
  const equipment = character.equipment;

  const slotConfig: Array<{
    slot: EquipmentSlot;
    label: string;
    icon?: string;
  }> = [
    { slot: 'helmet', label: 'Head', icon: '⛑️' },
    { slot: 'weapon', label: 'Weapon', icon: '⚔️' },
    { slot: 'offhand', label: 'Offhand', icon: '🛡️' },
    { slot: 'chest', label: 'Chest', icon: '🦺' },
    { slot: 'gloves', label: 'Gloves', icon: '🧤' },
    { slot: 'legs', label: 'Pants', icon: '👖' },
    { slot: 'boots', label: 'Boots', icon: '👢' },
    { slot: 'ring1', label: 'Ring 1', icon: '💍' },
    { slot: 'ring2', label: 'Ring 2', icon: '💍' },
    { slot: 'amulet', label: 'Amulet', icon: '📿' },
  ];

  const handleSlotClick = (slot: EquipmentSlot) => {
    if (equipment[slot]) {
      // Item is equipped, could show unequip option
      setSelectedSlot(selectedSlot === slot ? null : slot);
    } else {
      // Empty slot, could show item selection
      setSelectedSlot(selectedSlot === slot ? null : slot);
    }
  };

  const handleUnequip = (slot: EquipmentSlot) => {
    if (!equipment[slot]) return;

    const itemId = equipment[slot];
    if (!itemId) return;

    try {
      // Unequip item
      const updatedCharacter = CharacterManager.unequipItem(character, slot);
      setCharacter(updatedCharacter);

      // Play unequip sound
      audioManager.playSound('/audio/sfx/unequip.mp3', 0.5);

      // Add item back to inventory
      addItem(itemId, 1);

      setSelectedSlot(null);
    } catch (error) {
      console.error('Failed to unequip item:', error);
      alert(error instanceof Error ? error.message : 'Failed to unequip item');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item: Item, slot: EquipmentSlot) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      item,
      slot,
      position: { x: e.clientX, y: e.clientY },
    });
    setSelectedSlot(null);
  };

  const handleSell = (itemId: string, slot: EquipmentSlot) => {
    // First unequip, then sell
    handleUnequip(slot);
    const item = dataLoader.getItem(itemId);
    if (item) {
      const result = ShopManager.sellItem(inventory, item, 1);
      if (result.success && result.newInventory) {
        setInventory(result.newInventory);
      }
    }
  };

  const handleDrop = (itemId: string, slot: EquipmentSlot) => {
    // First unequip, then drop (item is already removed from inventory when equipped)
    handleUnequip(slot);
    // Item is already added back to inventory by handleUnequip, so we remove it
    const newInventory = InventoryManager.removeItem(inventory, itemId, 1);
    setInventory(newInventory);
  };

  const handleViewDetails = (itemId: string) => {
    const item = dataLoader.getItem(itemId);
    if (item) {
      alert(`${item.name}\n\n${item.description}`);
    }
  };

  const handleEquipItem = (itemId: string, slot: EquipmentSlot) => {
    try {
      const item = dataLoader.getItem(itemId);
      if (!item || item.equipmentSlot !== slot) {
        alert('Item cannot be equipped to this slot');
        return;
      }

      // Check if there's already an item in this slot
      let previousItemId: string | undefined;
      if (equipment[slot]) {
        previousItemId = equipment[slot];
      }

      // Equip the new item
      const updatedCharacter = CharacterManager.equipItem(character, itemId);
      setCharacter(updatedCharacter);

      // Play equip sound
      audioManager.playSound('/audio/sfx/equip.mp3', 0.6);

      // Remove item from inventory
      const newInventory = InventoryManager.removeItem(inventory, itemId, 1);
      setInventory(newInventory);

      // If there was a previous item, add it back to inventory
      if (previousItemId) {
        addItem(previousItemId, 1);
      }

      setSelectedSlot(null);
    } catch (error) {
      console.error('Failed to equip item:', error);
      alert(error instanceof Error ? error.message : 'Failed to equip item');
    }
  };

  const getEquippedItem = (slot: EquipmentSlot): Item | null => {
    const itemId = equipment[slot];
    if (!itemId) return null;
    return dataLoader.getItem(itemId) || null;
  };

  const getAvailableItemsForSlot = (slot: EquipmentSlot): Item[] => {
    return inventory.items
      .filter((invItem) => {
        const item = dataLoader.getItem(invItem.itemId);
        return item && item.equipmentSlot === slot;
      })
      .map((invItem) => dataLoader.getItem(invItem.itemId)!)
      .filter((item): item is Item => item !== undefined && item !== null);
  };

  return (
    <div className="equipment-panel">
      <h3>Equipment</h3>
      <div className="equipment-slots">
        {slotConfig.map(({ slot, label, icon }) => {
          const equippedItem = getEquippedItem(slot);
          const isSelected = selectedSlot === slot;

          return (
            <div key={slot} className="equipment-slot-container">
              <div
                className={`equipment-slot ${equippedItem ? 'equipped' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSlotClick(slot)}
                onDrop={(e) => {
                  e.preventDefault();
                  const itemId = e.dataTransfer.getData('text/plain');
                  if (itemId) {
                    handleEquipItem(itemId, slot);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
              >
                {icon && <div className="slot-icon">{icon}</div>}
                <div className="slot-label">{label}</div>
                {equippedItem ? (
                  <TooltipWrapper
                    content={`${equippedItem.name}\n${equippedItem.description || 'No description'}\n${equippedItem.type ? `Type: ${equippedItem.type}` : ''}${equippedItem.rarity ? `\nRarity: ${equippedItem.rarity}` : ''}`}
                  >
                    <div
                      className="equipped-item"
                      onContextMenu={(e) => handleContextMenu(e, equippedItem, slot)}
                    >
                      <div className="item-name">{equippedItem.name}</div>
                      {equippedItem.rarity && (
                        <div className={`item-rarity ${equippedItem.rarity}`}>
                          {equippedItem.rarity}
                        </div>
                      )}
                    </div>
                  </TooltipWrapper>
                ) : (
                  <TooltipWrapper content={`${label} slot - Drag an item here to equip`}>
                    <div className="empty-slot">Empty</div>
                  </TooltipWrapper>
                )}
              </div>
              {isSelected && (
                <div className="slot-actions">
                  {equippedItem ? (
                    <button className="unequip-button" onClick={() => handleUnequip(slot)}>
                      Unequip
                    </button>
                  ) : (
                    <div className="available-items">
                      <div className="available-items-header">Available Items:</div>
                      {getAvailableItemsForSlot(slot).length > 0 ? (
                        getAvailableItemsForSlot(slot).map((item) => {
                          const inventoryItem = inventory.items.find(
                            (invItem) => invItem.itemId === item.id
                          );
                          return (
                            <div
                              key={item.id}
                              className="available-item"
                              onClick={() => handleEquipItem(item.id, slot)}
                            >
                              <div className="item-name">{item.name}</div>
                              {inventoryItem && inventoryItem.quantity > 1 && (
                                <div className="item-quantity">x{inventoryItem.quantity}</div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="no-items-message">No items available</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {contextMenu && (
        <ItemContextMenu
          item={contextMenu.item}
          isEquipped={true}
          equippedSlot={contextMenu.slot}
          inventory={inventory}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onUnequip={(slot) => handleUnequip(slot as EquipmentSlot)}
          onSell={(itemId) => handleSell(itemId, contextMenu.slot)}
          onDrop={(itemId) => handleDrop(itemId, contextMenu.slot)}
          onViewDetails={handleViewDetails}
        />
      )}
    </div>
  );
}

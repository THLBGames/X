import { useEffect, useRef } from 'react';
import type { Item, Inventory } from '@idle-rpg/shared';
import { ShopManager } from '../systems/shop';
import './ItemContextMenu.css';

export interface ContextMenuAction {
  label: string;
  action: () => void;
  disabled?: boolean;
  danger?: boolean;
}

interface ItemContextMenuProps {
  item: Item;
  inventoryIndex?: number;
  isEquipped?: boolean;
  equippedSlot?: string;
  inventory?: Inventory;
  position: { x: number; y: number };
  onClose: () => void;
  onEquip?: (itemId: string) => void;
  onUnequip?: (slot: string) => void;
  onUse?: (itemId: string) => void;
  onSell?: (itemId: string, quantity?: number) => void;
  onDrop?: (itemId: string, quantity?: number) => void;
  onViewDetails?: (itemId: string) => void;
}

export default function ItemContextMenu({
  item,
  isEquipped,
  equippedSlot,
  inventory,
  position,
  onClose,
  onEquip,
  onUnequip,
  onUse,
  onSell,
  onDrop,
  onViewDetails,
}: ItemContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Small delay to prevent immediate closing when menu opens
    let handleClickOutside: ((event: MouseEvent) => void) | null = null;
    let handleEscape: ((event: KeyboardEvent) => void) | null = null;

    const timeoutId = setTimeout(() => {
      handleClickOutside = (event: MouseEvent) => {
        // Don't close if clicking on the menu itself
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          onClose();
        }
      };

      handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose();
        }
      };

      // Use click instead of mousedown to avoid immediate closing
      // Use a longer delay to ensure menu is fully rendered
      document.addEventListener('click', handleClickOutside, true);
      document.addEventListener('keydown', handleEscape);
    }, 100); // Increased delay to 100ms

    return () => {
      clearTimeout(timeoutId);
      if (handleClickOutside) {
        document.removeEventListener('click', handleClickOutside, true);
      }
      if (handleEscape) {
        document.removeEventListener('keydown', handleEscape);
      }
    };
  }, [onClose]);

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = position.x;
      let adjustedY = position.y;

      // Adjust horizontal position
      if (rect.right > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10;
      }
      if (adjustedX < 10) {
        adjustedX = 10;
      }

      // Adjust vertical position
      if (rect.bottom > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10;
      }
      if (adjustedY < 10) {
        adjustedY = 10;
      }

      menu.style.left = `${adjustedX}px`;
      menu.style.top = `${adjustedY}px`;
    }
  }, [position]);

  const getMenuActions = (): ContextMenuAction[] => {
    const actions: ContextMenuAction[] = [];

    // Equipment items
    if (item.equipmentSlot) {
      if (isEquipped && equippedSlot) {
        actions.push({
          label: 'Unequip',
          action: () => {
            onUnequip?.(equippedSlot);
            onClose();
          },
        });
      } else {
        actions.push({
          label: 'Equip',
          action: () => {
            onEquip?.(item.id);
            onClose();
          },
        });
      }
    }

    // Consumable items
    if (item.type === 'consumable' && item.consumableEffect) {
      actions.push({
        label: 'Use',
        action: () => {
          onUse?.(item.id);
          onClose();
        },
      });
    }

    // All items can be sold (except if equipped, then unequip first)
    // Check if item can actually be sold (has value, not gold, in inventory)
    if (!isEquipped && inventory && ShopManager.canSell(inventory, item.id)) {
      actions.push({
        label: 'Sell',
        action: () => {
          onSell?.(item.id);
          onClose();
        },
      });
    }

    // View details for all items
    actions.push({
      label: 'View Details',
      action: () => {
        onViewDetails?.(item.id);
        onClose();
      },
    });

    // Drop option (dangerous action)
    if (!isEquipped) {
      actions.push({
        label: 'Drop',
        action: () => {
          if (confirm(`Are you sure you want to drop ${item.name}?`)) {
            onDrop?.(item.id);
          }
          onClose();
        },
        danger: true,
      });
    }

    return actions;
  };

  const actions = getMenuActions();
  if (actions.length === 0) {
    console.warn('ItemContextMenu: No actions available, returning null');
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="item-context-menu"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        position: 'fixed',
        zIndex: 10000,
      }}
      onClick={(e) => {
        // Prevent clicks inside the menu from closing it
        e.stopPropagation();
      }}
    >
      <div className="context-menu-item-name">{item.name}</div>
      <div className="context-menu-divider" />
      {actions.map((action, index) => (
        <button
          key={index}
          className={`context-menu-action ${action.danger ? 'danger' : ''}`}
          onClick={action.action}
          disabled={action.disabled}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

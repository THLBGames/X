import { useState, useEffect } from 'react';
import { ShopManager } from '../systems/shop';
import { InventoryManager } from '../systems/inventory';
import { getDataLoader } from '../data';
import type { Item, Inventory } from '@idle-rpg/shared';
import './SellItemModal.css';

interface SellItemModalProps {
  item: Item;
  inventory: Inventory;
  onClose: () => void;
  onSell: (newInventory: Inventory) => void;
}

export default function SellItemModal({
  item,
  inventory,
  onClose,
  onSell,
}: SellItemModalProps) {
  const [quantity, setQuantity] = useState(1);
  const dataLoader = getDataLoader();

  // Get available quantity of this item
  const availableQuantity = InventoryManager.getItemQuantity(inventory, item.id);

  // Update quantity if it exceeds available
  useEffect(() => {
    if (quantity > availableQuantity) {
      setQuantity(availableQuantity);
    }
  }, [availableQuantity, quantity]);

  const sellPrice = ShopManager.calculateSellPrice(item) * quantity;
  const canSell = ShopManager.canSell(inventory, item.id) && quantity > 0 && quantity <= availableQuantity;

  const handleQuantityChange = (delta: number) => {
    const newQuantity = Math.max(1, Math.min(availableQuantity, quantity + delta));
    setQuantity(newQuantity);
  };

  const handleSell = () => {
    if (!canSell) return;

    const result = ShopManager.sellItem(inventory, item, quantity);
    if (result.success && result.newInventory) {
      onSell(result.newInventory);
      onClose();
    } else {
      alert(result.message);
    }
  };

  const handleMaxSell = () => {
    setQuantity(availableQuantity);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="sell-item-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Sell Item</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          <div className="item-info">
            <div className="item-name">{item.name}</div>
            <div className={`item-rarity rarity-${item.rarity}`}>{item.rarity}</div>
            <div className="item-description">{item.description}</div>
          </div>

          <div className="quantity-section">
            <div className="quantity-label">
              Quantity: <span className="available-quantity">({availableQuantity} available)</span>
            </div>
            {item.stackable && availableQuantity > 1 ? (
              <div className="quantity-selector">
                <button
                  className="qty-button"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                >
                  -
                </button>
                <input
                  type="number"
                  className="qty-input"
                  value={quantity}
                  min={1}
                  max={availableQuantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                      setQuantity(Math.max(1, Math.min(availableQuantity, val)));
                    }
                  }}
                />
                <button
                  className="qty-button"
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= availableQuantity}
                >
                  +
                </button>
                {availableQuantity > 1 && (
                  <button className="qty-max-button" onClick={handleMaxSell}>
                    Max
                  </button>
                )}
              </div>
            ) : (
              <div className="quantity-display">1</div>
            )}
          </div>

          <div className="sell-price-section">
            <div className="price-label">Sell Price:</div>
            <div className="price-value">{sellPrice} gold</div>
            <div className="price-per-item">
              ({ShopManager.calculateSellPrice(item)} gold per item)
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="sell-button"
            onClick={handleSell}
            disabled={!canSell}
          >
            Sell {quantity > 1 && `(${quantity})`}
          </button>
        </div>
      </div>
    </div>
  );
}


import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('ui');
  const dataLoader = getDataLoader();
  const [quantity, setQuantity] = useState(1);

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
          <h2>{t('sellItem.title')}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          <div className="item-info">
            <div className="item-name">{dataLoader.getTranslatedName(item)}</div>
            <div className={`item-rarity rarity-${item.rarity}`}>{t(`common.rarity.${item.rarity}`, { ns: 'common' })}</div>
            <div className="item-description">{dataLoader.getTranslatedDescription(item)}</div>
          </div>

          <div className="quantity-section">
            <div className="quantity-label">
              {t('sellItem.quantity')}: <span className="available-quantity">({availableQuantity} {t('sellItem.available')})</span>
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
                    {t('sellItem.max')}
                  </button>
                )}
              </div>
            ) : (
              <div className="quantity-display">1</div>
            )}
          </div>

          <div className="sell-price-section">
            <div className="price-label">{t('sellItem.sellPrice')}:</div>
            <div className="price-value">{sellPrice} {t('character.gold')}</div>
            <div className="price-per-item">
              ({ShopManager.calculateSellPrice(item)} {t('character.gold')} {t('sellItem.perItem')})
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose}>
            {t('buttons.cancel')}
          </button>
          <button
            className="sell-button"
            onClick={handleSell}
            disabled={!canSell}
          >
            {t('sellItem.sell')} {quantity > 1 && `(${quantity})`}
          </button>
        </div>
      </div>
    </div>
  );
}


import { getDataLoader } from '../data';
import './TreasureChestModal.css';

interface TreasureChestModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Array<{ itemId: string; quantity: number }>;
  gold?: number;
}

export default function TreasureChestModal({
  isOpen,
  onClose,
  items,
  gold,
}: TreasureChestModalProps) {
  if (!isOpen) return null;

  const dataLoader = getDataLoader();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content treasure-chest-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💎 Chest Opened!</h2>
          <button className="modal-close-button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="treasure-chest-message">
            You received the following items:
          </div>

          {gold !== undefined && gold > 0 && (
            <div className="treasure-gold">
              <span className="gold-icon">💰</span>
              <span className="gold-amount">+{gold} Gold</span>
            </div>
          )}

          {items.length > 0 && (
            <div className="treasure-items">
              <h3>Items:</h3>
              <div className="items-list">
                {items.map((item, idx) => {
                  const itemData = dataLoader.getItem(item.itemId);
                  const itemName = itemData ? dataLoader.getTranslatedName(itemData) : item.itemId;
                  const itemRarity = itemData?.rarity || 'common';
                  return (
                    <div key={idx} className={`item-reward rarity-${itemRarity}`}>
                      <span className="item-name">{itemName}</span>
                      <span className="item-quantity">x{item.quantity}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {items.length === 0 && (!gold || gold === 0) && (
            <div className="treasure-empty">
              The chest was empty... Better luck next time!
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="modal-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

import { useGameState } from '../systems';
import './InventoryPanel.css';

export default function InventoryPanel() {
  const inventory = useGameState((state) => state.inventory);

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
          inventory.items.map((item, index) => (
            <div key={index} className="inventory-item">
              <div className="item-name">{item.itemId}</div>
              <div className="item-quantity">x{item.quantity}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


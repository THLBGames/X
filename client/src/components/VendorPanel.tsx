import { useState, useEffect } from 'react';
import { useGameState } from '../systems';
import { VendorManager } from '../systems/city/VendorManager';
import type { Vendor, Item } from '@idle-rpg/shared';
import { InventoryManager } from '../systems/inventory';
import { getDataLoader } from '../data';
import './VendorPanel.css';

export default function VendorPanel() {
  const character = useGameState((state) => state.character);
  const inventory = useGameState((state) => state.inventory);
  const setInventory = useGameState((state) => state.setInventory);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorItems, setVendorItems] = useState<
    Array<{ item: Item; price: number; available: boolean; reason?: string }>
  >([]);
  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadVendors = async () => {
      if (character) {
        const available = await VendorManager.getAvailableVendors(character);
        setVendors(available);
      }
    };
    loadVendors();
  }, [character]);

  useEffect(() => {
    const loadVendorItems = async () => {
      if (character && selectedVendor) {
        const items = await VendorManager.getAvailableItems(character, selectedVendor.id);
        setVendorItems(items);
      }
    };
    loadVendorItems();
  }, [character, selectedVendor]);

  if (!character) {
    return <div className="vendor-panel">No character loaded</div>;
  }

  const dataLoader = getDataLoader();
  const gold = InventoryManager.getGold(inventory);

  const handleBuy = async (item: Item, quantity: number) => {
    if (!selectedVendor) return;

    const result = await VendorManager.purchaseFromVendor(
      character,
      inventory,
      selectedVendor.id,
      item.id,
      quantity
    );

    if (result.success && result.inventory) {
      setInventory(result.inventory);
      alert(`Purchased ${quantity}x ${dataLoader.getTranslatedName(item)}`);
    } else {
      alert(result.reason || 'Purchase failed');
    }
  };

  const handleSell = async (item: Item, quantity: number) => {
    if (!selectedVendor) return;

    const result = await VendorManager.sellToVendor(inventory, selectedVendor.id, item.id, quantity);

    if (result.success && result.inventory) {
      setInventory(result.inventory);
      alert(`Sold ${quantity}x ${dataLoader.getTranslatedName(item)} for ${result.goldEarned} gold`);
    } else {
      alert(result.reason || 'Sale failed');
    }
  };

  const updateBuyQuantity = (itemId: string, delta: number) => {
    setBuyQuantities((prev) => {
      const current = prev[itemId] || 1;
      const newQty = Math.max(1, current + delta);
      return { ...prev, [itemId]: newQty };
    });
  };

  return (
    <div className="vendor-panel">
      <div className="vendor-header">
        <h2>Vendors</h2>
        <div className="gold-display">Gold: {gold}</div>
      </div>

      <div className="vendor-content">
        <div className="vendor-list">
          <h3>Available Vendors</h3>
          {vendors.length === 0 ? (
            <div className="no-vendors">No vendors available. Build buildings or join guilds to unlock vendors.</div>
          ) : (
            vendors.map((vendor) => (
              <div
                key={vendor.id}
                className={`vendor-entry ${selectedVendor?.id === vendor.id ? 'selected' : ''}`}
                onClick={() => setSelectedVendor(vendor)}
              >
                <div className="vendor-name">{vendor.name}</div>
                <div className="vendor-description">{vendor.description}</div>
                {vendor.buildingId && (
                  <div className="vendor-location">Location: {vendor.buildingId}</div>
                )}
                {vendor.guildId && (
                  <div className="vendor-guild">Guild: {vendor.guildId}</div>
                )}
              </div>
            ))
          )}
        </div>

        {selectedVendor && (
          <div className="vendor-shop">
            <h3>{selectedVendor.name}</h3>
            <div className="vendor-shop-description">{selectedVendor.description}</div>

            <div className="shop-items">
              <h4>Items for Sale</h4>
              {vendorItems.length === 0 ? (
                <div className="no-items">No items available from this vendor.</div>
              ) : (
                vendorItems.map(({ item, price, available, reason }) => {
                  const quantity = buyQuantities[item.id] || 1;
                  const totalPrice = price * quantity;
                  const canAfford = gold >= totalPrice;

                  return (
                    <div key={item.id} className={`shop-item ${!available ? 'unavailable' : ''}`}>
                      <div className="item-info">
                        <div className="item-name">{dataLoader.getTranslatedName(item)}</div>
                        <div className="item-description">{dataLoader.getTranslatedDescription(item)}</div>
                        {!available && reason && (
                          <div className="unavailable-reason">{reason}</div>
                        )}
                      </div>
                      <div className="item-price">
                        <div className="price-per-item">{price} gold each</div>
                        {available && (
                          <div className="quantity-controls">
                            <button
                              className="quantity-button"
                              onClick={() => updateBuyQuantity(item.id, -1)}
                            >
                              -
                            </button>
                            <span className="quantity">{quantity}</span>
                            <button
                              className="quantity-button"
                              onClick={() => updateBuyQuantity(item.id, 1)}
                            >
                              +
                            </button>
                          </div>
                        )}
                        <div className="total-price">Total: {totalPrice} gold</div>
                        {available && (
                          <button
                            className="buy-button"
                            onClick={() => handleBuy(item, quantity)}
                            disabled={!canAfford}
                          >
                            Buy
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {selectedVendor.buybackRate && selectedVendor.buybackRate > 0 && (
              <div className="sell-section">
                <h4>Sell Items</h4>
                <div className="sell-info">
                  This vendor buys items at {Math.floor(selectedVendor.buybackRate * 100)}% of base value.
                </div>
                {/* Sell interface would go here - simplified for now */}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

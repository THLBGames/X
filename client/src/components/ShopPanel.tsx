import { useState, useMemo } from 'react';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { ShopManager } from '../systems/shop';
import { InventoryManager } from '../systems/inventory';
import type { Item } from '@idle-rpg/shared';
import './ShopPanel.css';

export default function ShopPanel() {
  const character = useGameState((state) => state.character);
  const inventory = useGameState((state) => state.inventory);
  const setInventory = useGameState((state) => state.setInventory);

  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [buyQuantity, setBuyQuantity] = useState<Record<string, number>>({});
  const [sellQuantity, setSellQuantity] = useState<Record<string, number>>({});

  const gold = InventoryManager.getGold(inventory);
  const categories = useMemo(() => {
    const cats = ShopManager.getShopCategories();
    return ['all', ...cats];
  }, []);

  const availableItems = useMemo(() => {
    let items = ShopManager.getAvailableItems();

    // Filter by category
    if (selectedCategory !== 'all') {
      items = items.filter((item) => item.type === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query)
      );
    }

    // Filter by requirements if character exists
    if (character) {
      items = items.filter((item) => ShopManager.meetsRequirements(item, character));
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedCategory, searchQuery, character]);

  const sellableItems = useMemo(() => {
    return ShopManager.getSellableItems(inventory).sort((a, b) =>
      a.item.name.localeCompare(b.item.name)
    );
  }, [inventory]);

  const handleBuy = (item: Item) => {
    if (!character) return;

    const quantity = buyQuantity[item.id] || 1;
    const result = ShopManager.purchaseItem(inventory, item, quantity);

    if (result.success && result.newInventory) {
      setInventory(result.newInventory);
      setBuyQuantity((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      alert(result.message);
    } else {
      alert(result.message);
    }
  };

  const handleSell = (item: Item, currentQuantity: number) => {
    const quantity = sellQuantity[item.id] || 1;
    const sellQty = Math.min(quantity, currentQuantity);

    const result = ShopManager.sellItem(inventory, item, sellQty);

    if (result.success && result.newInventory) {
      setInventory(result.newInventory);
      setSellQuantity((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      alert(result.message);
    } else {
      alert(result.message);
    }
  };

  const updateBuyQuantity = (itemId: string, delta: number) => {
    setBuyQuantity((prev) => {
      const current = prev[itemId] || 1;
      const newQty = Math.max(1, current + delta);
      return { ...prev, [itemId]: newQty };
    });
  };

  const updateSellQuantity = (itemId: string, delta: number, max: number) => {
    setSellQuantity((prev) => {
      const current = prev[itemId] || 1;
      const newQty = Math.max(1, Math.min(max, current + delta));
      return { ...prev, [itemId]: newQty };
    });
  };

  const canAfford = (item: Item, quantity: number = 1) => {
    return ShopManager.canAfford(inventory, item, quantity);
  };

  const getBuyPrice = (item: Item, quantity: number = 1) => {
    return ShopManager.calculateBuyPrice(item) * quantity;
  };

  const getSellPrice = (item: Item, quantity: number = 1) => {
    return ShopManager.calculateSellPrice(item) * quantity;
  };

  return (
    <div className="shop-panel">
      <div className="shop-header">
        <h2>Shop</h2>
        <div className="shop-gold">
          Gold: <span className="gold-amount">{gold.toLocaleString()}</span>
        </div>
      </div>

      <div className="shop-tabs">
        <button
          className={`shop-tab ${activeTab === 'buy' ? 'active' : ''}`}
          onClick={() => setActiveTab('buy')}
        >
          Buy
        </button>
        <button
          className={`shop-tab ${activeTab === 'sell' ? 'active' : ''}`}
          onClick={() => setActiveTab('sell')}
        >
          Sell
        </button>
      </div>

      {activeTab === 'buy' && (
        <div className="shop-buy">
          <div className="shop-filters">
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="shop-search"
            />
            <div className="shop-categories">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`category-button ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="shop-items-grid">
            {availableItems.length === 0 ? (
              <div className="no-items">No items available</div>
            ) : (
              availableItems.map((item) => {
                const quantity = buyQuantity[item.id] || 1;
                const price = getBuyPrice(item, quantity);
                const affordable = canAfford(item, quantity);

                return (
                  <div key={item.id} className="shop-item-card">
                    <div className="item-header">
                      <div className="item-name">{item.name}</div>
                      <div className={`item-rarity rarity-${item.rarity}`}>{item.rarity}</div>
                    </div>
                    <div className="item-description">{item.description}</div>
                    {item.requirements && (
                      <div className="item-requirements">
                        {item.requirements.level && (
                          <span className="requirement">Lv. {item.requirements.level}+</span>
                        )}
                        {item.requirements.class && (
                          <span className="requirement">
                            {item.requirements.class.join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="item-price">
                      <div className="price-label">Price:</div>
                      <div className={`price-value ${!affordable ? 'insufficient' : ''}`}>
                        {price} gold
                      </div>
                    </div>
                    {item.stackable && (
                      <div className="quantity-selector">
                        <button
                          className="qty-button"
                          onClick={() => updateBuyQuantity(item.id, -1)}
                        >
                          -
                        </button>
                        <span className="qty-value">{quantity}</span>
                        <button
                          className="qty-button"
                          onClick={() => updateBuyQuantity(item.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    )}
                    <button
                      className={`buy-button ${!affordable ? 'disabled' : ''}`}
                      onClick={() => handleBuy(item)}
                      disabled={!affordable}
                    >
                      Buy {quantity > 1 && `(${quantity})`}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'sell' && (
        <div className="shop-sell">
          <div className="sellable-items-list">
            {sellableItems.length === 0 ? (
              <div className="no-items">No items to sell</div>
            ) : (
              sellableItems.map(({ item, quantity: availableQty }) => {
                const sellQty = sellQuantity[item.id] || 1;
                const price = getSellPrice(item, sellQty);

                return (
                  <div key={item.id} className="sell-item-card">
                    <div className="item-header">
                      <div className="item-name">{item.name}</div>
                      <div className="item-stock">x{availableQty}</div>
                    </div>
                    <div className="item-description">{item.description}</div>
                    <div className="item-sell-price">
                      <div className="price-label">Sell for:</div>
                      <div className="price-value">{price} gold</div>
                    </div>
                    {item.stackable && availableQty > 1 && (
                      <div className="quantity-selector">
                        <button
                          className="qty-button"
                          onClick={() => updateSellQuantity(item.id, -1, availableQty)}
                        >
                          -
                        </button>
                        <span className="qty-value">{sellQty}</span>
                        <button
                          className="qty-button"
                          onClick={() => updateSellQuantity(item.id, 1, availableQty)}
                        >
                          +
                        </button>
                      </div>
                    )}
                    <button
                      className="sell-button"
                      onClick={() => handleSell(item, availableQty)}
                    >
                      Sell {sellQty > 1 && `(${sellQty})`}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}


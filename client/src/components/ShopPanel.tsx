import { useState, useMemo } from 'react';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { ShopManager } from '../systems/shop';
import { MercenaryManager } from '../systems/mercenary/MercenaryManager';
import { UpgradeManager } from '../systems/upgrade/UpgradeManager';
import { InventoryManager } from '../systems/inventory';
import type { Item } from '@idle-rpg/shared';
import './ShopPanel.css';

export default function ShopPanel() {
  const character = useGameState((state) => state.character);
  const inventory = useGameState((state) => state.inventory);
  const setInventory = useGameState((state) => state.setInventory);

  const [activeTab, setActiveTab] = useState<'buy' | 'sell' | 'mercenaries' | 'upgrades'>('buy');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [mercenaryFilter, setMercenaryFilter] = useState<string>('all');
  const [upgradeTypeFilter, setUpgradeTypeFilter] = useState<'all' | 'permanent' | 'consumable'>('all');
  const [upgradeScopeFilter, setUpgradeScopeFilter] = useState<'all' | 'skill' | 'category'>('all');
  const [_upgradeSkillFilter, _setUpgradeSkillFilter] = useState<string>('all');
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
        <button
          className={`shop-tab ${activeTab === 'mercenaries' ? 'active' : ''}`}
          onClick={() => setActiveTab('mercenaries')}
        >
          Mercenaries
        </button>
        <button
          className={`shop-tab ${activeTab === 'upgrades' ? 'active' : ''}`}
          onClick={() => setActiveTab('upgrades')}
        >
          Upgrades
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

      {activeTab === 'mercenaries' && (
        <div className="shop-mercenaries">
          <div className="active-mercenaries-section">
            <h3>Active Mercenaries</h3>
            {character && character.activeMercenaries && character.activeMercenaries.length > 0 ? (
              <div className="active-mercenaries-list">
                {character.activeMercenaries.map((activeMercenary) => {
                  const dataLoader = getDataLoader();
                  const mercenary = dataLoader.getMercenary(activeMercenary.mercenaryId);
                  if (!mercenary) return null;

                  return (
                    <div key={activeMercenary.mercenaryId} className="active-mercenary-card">
                      <div className="mercenary-header">
                        <div className="mercenary-name">{mercenary.name}</div>
                        <div className={`mercenary-type ${mercenary.type}`}>
                          {mercenary.type === 'combat' ? 'Combat' : 'Skilling'}
                        </div>
                      </div>
                      <div className="mercenary-description">{mercenary.description}</div>
                      <div className="mercenary-duration">
                        {mercenary.type === 'combat' ? (
                          <>
                            Remaining Battles: {activeMercenary.remainingBattles || 0} / {mercenary.duration}
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${((activeMercenary.remainingBattles || 0) / mercenary.duration) * 100}%`,
                                }}
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            Remaining Actions: {activeMercenary.remainingActions || 0} / {mercenary.duration}
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${((activeMercenary.remainingActions || 0) / mercenary.duration) * 100}%`,
                                }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                      <button
                        className="dismiss-button"
                        onClick={() => {
                          const removeMercenary = useGameState.getState().removeMercenary;
                          removeMercenary(activeMercenary.mercenaryId);
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-mercenaries">No active mercenaries</div>
            )}
          </div>

          <div className="available-mercenaries-section">
            <h3>Available Mercenaries</h3>
            <div className="mercenaries-filter">
              <button
                className={`filter-button ${mercenaryFilter === 'all' ? 'active' : ''}`}
                onClick={() => setMercenaryFilter('all')}
              >
                All
              </button>
              <button
                className={`filter-button ${mercenaryFilter === 'combat' ? 'active' : ''}`}
                onClick={() => setMercenaryFilter('combat')}
              >
                Combat
              </button>
              <button
                className={`filter-button ${mercenaryFilter === 'skilling' ? 'active' : ''}`}
                onClick={() => setMercenaryFilter('skilling')}
              >
                Skilling
              </button>
            </div>
            <div className="mercenaries-grid">
              {(() => {
                const dataLoader = getDataLoader();
                let mercenaries = dataLoader.getAllMercenaries();

                // Filter by type
                if (mercenaryFilter === 'combat') {
                  mercenaries = mercenaries.filter((m) => m.type === 'combat');
                } else if (mercenaryFilter === 'skilling') {
                  mercenaries = mercenaries.filter((m) => m.type === 'skilling');
                }

                // Filter out already active mercenaries
                if (character) {
                  const activeIds = (character.activeMercenaries || []).map((m) => m.mercenaryId);
                  mercenaries = mercenaries.filter((m) => !activeIds.includes(m.id));
                }

                return mercenaries.length === 0 ? (
                  <div className="no-items">No mercenaries available</div>
                ) : (
                  mercenaries.map((mercenary) => {
                    const canRent = character && MercenaryManager.canRentMore(character);
                    const canAfford = gold >= mercenary.price;

                    return (
                      <div key={mercenary.id} className="mercenary-card">
                        <div className="mercenary-header">
                          <div className="mercenary-name">{mercenary.name}</div>
                          <div className={`mercenary-type ${mercenary.type}`}>
                            {mercenary.type === 'combat' ? 'Combat' : 'Skilling'}
                          </div>
                        </div>
                        <div className="mercenary-description">{mercenary.description}</div>
                        {mercenary.type === 'combat' && mercenary.stats && (
                          <div className="mercenary-stats">
                            <div className="stat-row">
                              <span>Health:</span>
                              <span>{mercenary.stats.health}</span>
                            </div>
                            <div className="stat-row">
                              <span>Attack:</span>
                              <span>{mercenary.stats.attack}</span>
                            </div>
                            <div className="stat-row">
                              <span>Defense:</span>
                              <span>{mercenary.stats.defense}</span>
                            </div>
                            <div className="stat-row">
                              <span>Speed:</span>
                              <span>{mercenary.stats.speed}</span>
                            </div>
                            <div className="stat-duration">
                              Duration: {mercenary.duration} battles
                            </div>
                          </div>
                        )}
                        {mercenary.type === 'skilling' && mercenary.bonuses && (
                          <div className="mercenary-bonuses">
                            {mercenary.bonuses.experienceMultiplier && (
                              <div className="bonus-row">
                                <span>XP Bonus:</span>
                                <span>+{Math.round((mercenary.bonuses.experienceMultiplier - 1) * 100)}%</span>
                              </div>
                            )}
                            {mercenary.bonuses.speedMultiplier && (
                              <div className="bonus-row">
                                <span>Speed:</span>
                                <span>
                                  {mercenary.bonuses.speedMultiplier < 1
                                    ? `-${Math.round((1 - mercenary.bonuses.speedMultiplier) * 100)}%`
                                    : `+${Math.round((mercenary.bonuses.speedMultiplier - 1) * 100)}%`}
                                </span>
                              </div>
                            )}
                            {mercenary.bonuses.yieldMultiplier && (
                              <div className="bonus-row">
                                <span>Yield Bonus:</span>
                                <span>+{Math.round((mercenary.bonuses.yieldMultiplier - 1) * 100)}%</span>
                              </div>
                            )}
                            <div className="stat-duration">
                              Duration: {mercenary.duration} actions
                            </div>
                          </div>
                        )}
                        <div className="mercenary-price">
                          <div className="price-label">Rental Price:</div>
                          <div className={`price-value ${!canAfford ? 'insufficient' : ''}`}>
                            {mercenary.price} gold
                          </div>
                        </div>
                        <button
                          className={`rent-button ${!canRent || !canAfford ? 'disabled' : ''}`}
                          onClick={() => {
                            if (!character) return;
                            const rentMercenary = useGameState.getState().rentMercenary;
                            const result = MercenaryManager.rentMercenary(
                              inventory,
                              character,
                              mercenary.id
                            );
                            if (result.success && result.newInventory) {
                              useGameState.getState().setInventory(result.newInventory);
                              rentMercenary(mercenary.id);
                              alert(result.message);
                            } else {
                              alert(result.message);
                            }
                          }}
                          disabled={!canRent || !canAfford}
                        >
                          {!canRent ? 'Max Mercenaries' : !canAfford ? 'Cannot Afford' : 'Rent'}
                        </button>
                      </div>
                    );
                  })
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'upgrades' && (
        <div className="shop-upgrades">
          <div className="active-consumables-section">
            <h3>Active Consumable Upgrades</h3>
            {character && character.consumableUpgrades && character.consumableUpgrades.length > 0 ? (
              <div className="active-consumables-list">
                {character.consumableUpgrades.map((consumableUpgrade) => {
                  const dataLoader = getDataLoader();
                  const upgrade = dataLoader.getUpgrade(consumableUpgrade.upgradeId);
                  if (!upgrade) return null;

                  return (
                    <div key={consumableUpgrade.upgradeId} className="active-consumable-card">
                      <div className="upgrade-header">
                        <div className="upgrade-name">{upgrade.name}</div>
                        <div className={`upgrade-scope ${upgrade.scope}`}>
                          {upgrade.scope === 'skill' ? upgrade.skillId : upgrade.category}
                        </div>
                      </div>
                      <div className="upgrade-description">{upgrade.description}</div>
                      <div className="upgrade-duration">
                        Remaining Actions: {consumableUpgrade.remainingActions || 0} / {upgrade.actionDuration || 0}
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${((consumableUpgrade.remainingActions || 0) / (upgrade.actionDuration || 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-consumables">No active consumable upgrades</div>
            )}
          </div>

          <div className="available-upgrades-section">
            <h3>Available Upgrades</h3>
            <div className="upgrades-filters">
              <div className="filter-group">
                <label>Type:</label>
                <button
                  className={`filter-button ${upgradeTypeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setUpgradeTypeFilter('all')}
                >
                  All
                </button>
                <button
                  className={`filter-button ${upgradeTypeFilter === 'permanent' ? 'active' : ''}`}
                  onClick={() => setUpgradeTypeFilter('permanent')}
                >
                  Permanent
                </button>
                <button
                  className={`filter-button ${upgradeTypeFilter === 'consumable' ? 'active' : ''}`}
                  onClick={() => setUpgradeTypeFilter('consumable')}
                >
                  Consumable
                </button>
              </div>
              <div className="filter-group">
                <label>Scope:</label>
                <button
                  className={`filter-button ${upgradeScopeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setUpgradeScopeFilter('all')}
                >
                  All
                </button>
                <button
                  className={`filter-button ${upgradeScopeFilter === 'skill' ? 'active' : ''}`}
                  onClick={() => setUpgradeScopeFilter('skill')}
                >
                  Skill
                </button>
                <button
                  className={`filter-button ${upgradeScopeFilter === 'category' ? 'active' : ''}`}
                  onClick={() => setUpgradeScopeFilter('category')}
                >
                  Category
                </button>
              </div>
            </div>
            <div className="upgrades-grid">
              {(() => {
                const dataLoader = getDataLoader();
                let upgrades = dataLoader.getAllUpgrades();

                // Filter by type
                if (upgradeTypeFilter === 'permanent') {
                  upgrades = upgrades.filter((u) => u.type === 'permanent');
                } else if (upgradeTypeFilter === 'consumable') {
                  upgrades = upgrades.filter((u) => u.type === 'consumable');
                }

                // Filter by scope
                if (upgradeScopeFilter === 'skill') {
                  upgrades = upgrades.filter((u) => u.scope === 'skill');
                } else if (upgradeScopeFilter === 'category') {
                  upgrades = upgrades.filter((u) => u.scope === 'category');
                }

                // Filter out already purchased permanent upgrades (unless they can be upgraded)
                if (character) {
                  upgrades = upgrades.filter((upgrade) => {
                    if (upgrade.type === 'permanent') {
                      const existing = character.activeUpgrades?.find((au) => au.upgradeId === upgrade.id);
                      if (existing) {
                        // Only show if can be upgraded (not at max tier)
                        return existing.tier !== 'V';
                      }
                    }
                    // For consumables, always show (can stack)
                    return true;
                  });
                }

                return upgrades.length === 0 ? (
                  <div className="no-items">No upgrades available</div>
                ) : (
                  upgrades.map((upgrade) => {
                    const existingUpgrade = character?.activeUpgrades?.find(
                      (au) => au.upgradeId === upgrade.id
                    );
                    const canUpgrade = character ? UpgradeManager.canUpgrade(character, upgrade) : { canUpgrade: false };
                    const currentTier = existingUpgrade?.tier;
                    const price = UpgradeManager.getUpgradePrice(upgrade, currentTier);
                    const canAfford = gold >= price;

                    return (
                      <div key={upgrade.id} className="upgrade-card">
                        <div className="upgrade-header">
                          <div className="upgrade-name">{upgrade.name}</div>
                          {upgrade.tier && (
                            <div className="upgrade-tier">Tier {upgrade.tier}</div>
                          )}
                          {upgrade.type === 'consumable' && (
                            <div className="upgrade-type-consumable">Consumable</div>
                          )}
                        </div>
                        <div className="upgrade-description">{upgrade.description}</div>
                        {upgrade.bonuses && (
                          <div className="upgrade-bonuses">
                            {upgrade.bonuses.experienceMultiplier && (
                              <div className="bonus-row">
                                <span>XP:</span>
                                <span>+{Math.round((upgrade.bonuses.experienceMultiplier - 1) * 100)}%</span>
                              </div>
                            )}
                            {upgrade.bonuses.speedMultiplier && (
                              <div className="bonus-row">
                                <span>Speed:</span>
                                <span>
                                  {upgrade.bonuses.speedMultiplier < 1
                                    ? `-${Math.round((1 - upgrade.bonuses.speedMultiplier) * 100)}%`
                                    : `+${Math.round((upgrade.bonuses.speedMultiplier - 1) * 100)}%`}
                                </span>
                              </div>
                            )}
                            {upgrade.bonuses.yieldMultiplier && (
                              <div className="bonus-row">
                                <span>Yield:</span>
                                <span>+{Math.round((upgrade.bonuses.yieldMultiplier - 1) * 100)}%</span>
                              </div>
                            )}
                            {upgrade.bonuses.successRateBonus && (
                              <div className="bonus-row">
                                <span>Success:</span>
                                <span>+{Math.round(upgrade.bonuses.successRateBonus * 100)}%</span>
                              </div>
                            )}
                            {upgrade.actionDuration && (
                              <div className="bonus-row">
                                <span>Duration:</span>
                                <span>{upgrade.actionDuration} actions</span>
                              </div>
                            )}
                          </div>
                        )}
                        {existingUpgrade && (
                          <div className="current-tier">
                            Current: Tier {existingUpgrade.tier}
                          </div>
                        )}
                        <div className="upgrade-price">
                          <div className="price-label">Price:</div>
                          <div className={`price-value ${!canAfford ? 'insufficient' : ''}`}>
                            {price} gold
                          </div>
                        </div>
                        <button
                          className={`upgrade-button ${!canUpgrade.canUpgrade || !canAfford ? 'disabled' : ''}`}
                          onClick={() => {
                            if (!character) return;
                            if (upgrade.type === 'permanent') {
                              const purchaseUpgrade = useGameState.getState().purchaseUpgrade;
                              const result = UpgradeManager.purchaseUpgrade(
                                inventory,
                                character,
                                upgrade.id
                              );
                              if (result.success && result.newInventory) {
                                useGameState.getState().setInventory(result.newInventory);
                                purchaseUpgrade(upgrade.id);
                                alert(result.message);
                              } else {
                                alert(result.message);
                              }
                            } else {
                              const activateConsumable = useGameState.getState().activateConsumable;
                              const result = UpgradeManager.activateConsumable(
                                inventory,
                                character,
                                upgrade.id
                              );
                              if (result.success && result.newInventory) {
                                useGameState.getState().setInventory(result.newInventory);
                                activateConsumable(upgrade.id);
                                alert(result.message);
                              } else {
                                alert(result.message);
                              }
                            }
                          }}
                          disabled={!canUpgrade.canUpgrade || !canAfford}
                        >
                          {!canUpgrade.canUpgrade
                            ? canUpgrade.reason || 'Cannot Purchase'
                            : !canAfford
                            ? 'Cannot Afford'
                            : existingUpgrade
                            ? 'Upgrade'
                            : upgrade.type === 'permanent'
                            ? 'Purchase'
                            : 'Activate'}
                        </button>
                      </div>
                    );
                  })
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


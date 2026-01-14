import { useState, useEffect } from 'react';
import { useGameState } from '../systems';
import { UnlockTreeManager } from '../systems/divination/UnlockTreeManager';
import { getDataLoader } from '../data';
import { InventoryManager } from '../systems/inventory';
import type { UnlockTreeNode } from '@idle-rpg/shared';
import './DivinationUnlockTree.css';

interface DivinationUnlockTreeProps {
  skillId: string;
}

export default function DivinationUnlockTree({ skillId }: DivinationUnlockTreeProps) {
  const character = useGameState((state) => state.character);
  const inventory = useGameState((state) => state.inventory);
  const setCharacter = useGameState((state) => state.setCharacter);
  const setInventory = useGameState((state) => state.setInventory);

  const [nodes, setNodes] = useState<UnlockTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'combat' | 'skilling' | 'inventory' | 'utility' | 'all'>('all');

  useEffect(() => {
    async function loadNodes() {
      const loadedNodes = await UnlockTreeManager.getUnlockTreeNodes();
      setNodes(loadedNodes);
      setLoading(false);
    }
    loadNodes();
  }, []);

  if (!character) {
    return null;
  }

  if (loading) {
    return <div className="unlock-tree-loading">Loading unlock tree...</div>;
  }

  const dataLoader = getDataLoader();
  const unlockedNodes = character.divinationUnlocks || [];
  const skillLevel = character.idleSkills?.find((s) => s.skillId === skillId)?.level || 0;

  // Filter nodes by category
  const filteredNodes = selectedCategory === 'all'
    ? nodes
    : nodes.filter((node) => node.category === selectedCategory);

  // Group nodes by category for display
  const nodesByCategory = {
    combat: nodes.filter((n) => n.category === 'combat'),
    skilling: nodes.filter((n) => n.category === 'skilling'),
    inventory: nodes.filter((n) => n.category === 'inventory'),
    utility: nodes.filter((n) => n.category === 'utility'),
  };

  const handleUnlock = async (nodeId: string) => {
    if (!character || !inventory) return;

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Check if can unlock
    const canUnlock = UnlockTreeManager.canUnlockNodeWithData(character, inventory, node);
    if (!canUnlock.canUnlock) {
      alert(canUnlock.reason || 'Cannot unlock node');
      return;
    }

    // Confirm if expensive
    const totalCost = node.cost.reduce((sum, cost) => sum + cost.quantity, 0);
    if (totalCost > 100) {
      const confirmed = window.confirm(
        `Unlock ${node.name}?\n\nCost: ${node.cost.map((c) => {
          const item = dataLoader.getItem(c.itemId);
          return `${c.quantity}x ${item?.name || c.itemId}`;
        }).join(', ')}\n\nBonuses: ${JSON.stringify(node.bonuses, null, 2)}`
      );
      if (!confirmed) return;
    }

    // Unlock the node
    const result = UnlockTreeManager.unlockNode(character, inventory, nodeId);
    if (result.success && result.character && result.inventory) {
      setCharacter(result.character);
      setInventory(result.inventory);
    } else {
      alert(result.reason || 'Failed to unlock node');
    }
  };

  const renderNode = (node: UnlockTreeNode) => {
    const isUnlocked = unlockedNodes.includes(node.id);
    const canUnlock = UnlockTreeManager.canUnlockNodeWithData(character, inventory, node);
    const hasPrerequisites = !node.prerequisites || node.prerequisites.every((id) => unlockedNodes.includes(id));
    const hasSkillLevel = !node.skillLevelRequirement || skillLevel >= node.skillLevelRequirement;

    return (
      <div
        key={node.id}
        className={`unlock-tree-node ${isUnlocked ? 'unlocked' : ''} ${canUnlock.canUnlock ? 'available' : 'locked'}`}
      >
        <div className="unlock-node-header">
          <span className="unlock-node-name">{node.name}</span>
          {isUnlocked && <span className="unlock-node-badge">✓ Unlocked</span>}
        </div>
        <div className="unlock-node-description">{node.description}</div>
        {!isUnlocked && (
          <>
            <div className="unlock-node-cost">
              <div className="cost-label">Cost:</div>
              <div className="cost-items">
                {node.cost.map((cost, idx) => {
                  const item = dataLoader.getItem(cost.itemId);
                  const itemName = item?.name || cost.itemId;
                  const have = InventoryManager.getItemQuantity(inventory, cost.itemId);
                  const hasEnough = have >= cost.quantity;
                  return (
                    <div key={idx} className={`cost-item ${hasEnough ? '' : 'missing'}`}>
                      {cost.quantity}x {itemName} {!hasEnough && `(have ${have})`}
                    </div>
                  );
                })}
              </div>
            </div>
            {node.skillLevelRequirement && (
              <div className={`unlock-node-requirement ${hasSkillLevel ? 'met' : 'unmet'}`}>
                Requires Divination Level {node.skillLevelRequirement} {hasSkillLevel ? '✓' : `(have ${skillLevel})`}
              </div>
            )}
            {node.prerequisites && node.prerequisites.length > 0 && (
              <div className={`unlock-node-requirement ${hasPrerequisites ? 'met' : 'unmet'}`}>
                Prerequisites: {node.prerequisites.map((id) => {
                  const prereqNode = nodes.find((n) => n.id === id);
                  return prereqNode?.name || id;
                }).join(', ')} {hasPrerequisites ? '✓' : ''}
              </div>
            )}
            {!canUnlock.canUnlock && canUnlock.reason && (
              <div className="unlock-node-error">{canUnlock.reason}</div>
            )}
            <button
              className="unlock-node-button"
              onClick={() => handleUnlock(node.id)}
              disabled={!canUnlock.canUnlock}
            >
              Unlock
            </button>
          </>
        )}
        {isUnlocked && node.bonuses && (
          <div className="unlock-node-bonuses">
            <div className="bonuses-label">Bonuses:</div>
            {node.bonuses.statBonus && (
              <div className="bonus-section">
                {Object.entries(node.bonuses.statBonus).map(([stat, value]) => (
                  <div key={stat} className="bonus-item">+{value} {stat}</div>
                ))}
              </div>
            )}
            {node.bonuses.combatStatBonus && (
              <div className="bonus-section">
                {Object.entries(node.bonuses.combatStatBonus).map(([stat, value]) => (
                  <div key={stat} className="bonus-item">+{value} {stat}</div>
                ))}
              </div>
            )}
            {node.bonuses.combatMultiplier && (
              <div className="bonus-section">
                {node.bonuses.combatMultiplier.experience && (
                  <div className="bonus-item">+{((node.bonuses.combatMultiplier.experience - 1) * 100).toFixed(0)}% Combat XP</div>
                )}
                {node.bonuses.combatMultiplier.gold && (
                  <div className="bonus-item">+{((node.bonuses.combatMultiplier.gold - 1) * 100).toFixed(0)}% Combat Gold</div>
                )}
                {node.bonuses.combatMultiplier.itemDropRate && (
                  <div className="bonus-item">+{((node.bonuses.combatMultiplier.itemDropRate - 1) * 100).toFixed(0)}% Item Drop Rate</div>
                )}
              </div>
            )}
            {node.bonuses.skillMultiplier && (
              <div className="bonus-section">
                {node.bonuses.skillMultiplier.experience && (
                  <div className="bonus-item">+{((node.bonuses.skillMultiplier.experience - 1) * 100).toFixed(0)}% Skill XP</div>
                )}
                {node.bonuses.skillMultiplier.speed && (
                  <div className="bonus-item">+{((1 / node.bonuses.skillMultiplier.speed - 1) * 100).toFixed(0)}% Skill Speed</div>
                )}
                {node.bonuses.skillMultiplier.yield && (
                  <div className="bonus-item">+{((node.bonuses.skillMultiplier.yield - 1) * 100).toFixed(0)}% Resource Yield</div>
                )}
              </div>
            )}
            {node.bonuses.inventorySlots && (
              <div className="bonus-item">+{node.bonuses.inventorySlots} Inventory Slots</div>
            )}
            {node.bonuses.offlineTimeHours && (
              <div className="bonus-item">+{node.bonuses.offlineTimeHours} Offline Hours</div>
            )}
            {node.bonuses.maxMercenaries && (
              <div className="bonus-item">+{node.bonuses.maxMercenaries} Mercenary Slot</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="divination-unlock-tree">
      <div className="unlock-tree-header">
        <h3>Divination Unlock Tree</h3>
        <div className="unlock-tree-category-filter">
          <button
            className={selectedCategory === 'all' ? 'active' : ''}
            onClick={() => setSelectedCategory('all')}
          >
            All
          </button>
          <button
            className={selectedCategory === 'combat' ? 'active' : ''}
            onClick={() => setSelectedCategory('combat')}
          >
            Combat ({nodesByCategory.combat.filter((n) => unlockedNodes.includes(n.id)).length}/{nodesByCategory.combat.length})
          </button>
          <button
            className={selectedCategory === 'skilling' ? 'active' : ''}
            onClick={() => setSelectedCategory('skilling')}
          >
            Skilling ({nodesByCategory.skilling.filter((n) => unlockedNodes.includes(n.id)).length}/{nodesByCategory.skilling.length})
          </button>
          <button
            className={selectedCategory === 'inventory' ? 'active' : ''}
            onClick={() => setSelectedCategory('inventory')}
          >
            Inventory ({nodesByCategory.inventory.filter((n) => unlockedNodes.includes(n.id)).length}/{nodesByCategory.inventory.length})
          </button>
          <button
            className={selectedCategory === 'utility' ? 'active' : ''}
            onClick={() => setSelectedCategory('utility')}
          >
            Utility ({nodesByCategory.utility.filter((n) => unlockedNodes.includes(n.id)).length}/{nodesByCategory.utility.length})
          </button>
        </div>
      </div>
      <div className="unlock-tree-nodes">
        {filteredNodes.length === 0 ? (
          <div className="unlock-tree-empty">No nodes in this category</div>
        ) : (
          filteredNodes.map((node) => renderNode(node))
        )}
      </div>
    </div>
  );
}

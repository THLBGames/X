import type {
  Character,
  Inventory,
  UnlockTreeNode,
  DivinationUnlockBonuses,
} from '@idle-rpg/shared';
import { MAX_INVENTORY_SLOTS } from '@idle-rpg/shared';
import { getDataLoader } from '@/data';
import { InventoryManager } from '../inventory';
import { IdleSkillSystem } from '../skills/IdleSkillSystem';

export class UnlockTreeManager {
  /**
   * Load unlock tree nodes from data
   */
  static async loadUnlockTree(): Promise<UnlockTreeNode[]> {
    try {
      const response = await fetch('/data/divination/unlock_tree.json');
      if (!response.ok) {
        console.error('Failed to load unlock tree:', response.statusText);
        return [];
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error loading unlock tree:', error);
      return [];
    }
  }

  /**
   * Get all unlock tree nodes (cached)
   */
  private static unlockTreeCache: UnlockTreeNode[] | null = null;
  static async getUnlockTreeNodes(): Promise<UnlockTreeNode[]> {
    if (!this.unlockTreeCache) {
      this.unlockTreeCache = await this.loadUnlockTree();
    }
    return this.unlockTreeCache;
  }

  /**
   * Get a specific unlock tree node by ID
   */
  static async getUnlockTreeNode(nodeId: string): Promise<UnlockTreeNode | undefined> {
    const nodes = await this.getUnlockTreeNodes();
    return nodes.find((node) => node.id === nodeId);
  }

  /**
   * Get unlock tree nodes by category
   */
  static async getUnlockTreeNodesByCategory(
    category: 'combat' | 'skilling' | 'inventory' | 'utility'
  ): Promise<UnlockTreeNode[]> {
    const nodes = await this.getUnlockTreeNodes();
    return nodes.filter((node) => node.category === category);
  }

  /**
   * Check if a node can be unlocked
   */
  static canUnlockNode(
    character: Character,
    nodeId: string
  ): { canUnlock: boolean; reason?: string } {
    //const dataLoader = getDataLoader();
    
    // Get node data synchronously (if cached) or return false
    // Note: This assumes nodes are preloaded. For now, return error if not cached.
    // In practice, UI should ensure nodes are loaded before calling this.
    
    // Check if already unlocked
    const unlockedNodes = character.divinationUnlocks || [];
    if (unlockedNodes.includes(nodeId)) {
      return { canUnlock: false, reason: 'Node already unlocked' };
    }

    // For now, we'll need to load nodes asynchronously in the actual implementation
    // This is a simplified version that will be used by the UI after loading
    return { canUnlock: true };
  }

  /**
   * Check if a node can be unlocked (with node data provided)
   */
  static canUnlockNodeWithData(
    character: Character,
    inventory: Inventory,
    node: UnlockTreeNode
  ): { canUnlock: boolean; reason?: string } {
    // Check if already unlocked
    const unlockedNodes = character.divinationUnlocks || [];
    if (unlockedNodes.includes(node.id)) {
      return { canUnlock: false, reason: 'Node already unlocked' };
    }

    // Check skill level requirement
    if (node.skillLevelRequirement) {
      const skillLevel = IdleSkillSystem.getSkillLevel(character, 'divination');
      if (skillLevel < node.skillLevelRequirement) {
        return {
          canUnlock: false,
          reason: `Requires divination level ${node.skillLevelRequirement}`,
        };
      }
    }

    // Check prerequisites
    if (node.prerequisites && node.prerequisites.length > 0) {
      for (const prereqId of node.prerequisites) {
        if (!unlockedNodes.includes(prereqId)) {
          //const dataLoader = getDataLoader();
          const prereqNode = this.unlockTreeCache?.find((n) => n.id === prereqId);
          const prereqName = prereqNode?.name || prereqId;
          return {
            canUnlock: false,
            reason: `Requires ${prereqName} to be unlocked first`,
          };
        }
      }
    }

    // Check resource costs
    for (const cost of node.cost) {
      const quantity = InventoryManager.getItemQuantity(inventory, cost.itemId);
      if (quantity < cost.quantity) {
        const item = getDataLoader().getItem(cost.itemId);
        const itemName = item?.name || cost.itemId;
        return {
          canUnlock: false,
          reason: `Need ${cost.quantity}x ${itemName} (have ${quantity})`,
        };
      }
    }

    return { canUnlock: true };
  }

  /**
   * Unlock a node (deduct resources and add to character)
   */
  static unlockNode(
    character: Character,
    inventory: Inventory,
    nodeId: string
  ): { success: boolean; character?: Character; inventory?: Inventory; reason?: string } {
    // This method will be called after canUnlockNodeWithData returns true
    // So we assume the check has already been done
    const unlockedNodes = character.divinationUnlocks || [];
    if (unlockedNodes.includes(nodeId)) {
      return { success: false, reason: 'Node already unlocked' };
    }

    // Find node in cache
    const node = this.unlockTreeCache?.find((n) => n.id === nodeId);
    if (!node) {
      return { success: false, reason: 'Node not found' };
    }

    // Check again with data
    const canUnlock = this.canUnlockNodeWithData(character, inventory, node);
    if (!canUnlock.canUnlock) {
      return { success: false, reason: canUnlock.reason };
    }

    // Deduct resources
    let newInventory = inventory;
    for (const cost of node.cost) {
      newInventory = InventoryManager.removeItem(newInventory, cost.itemId, cost.quantity);
    }

    // Add to unlocked nodes
    const newUnlockedNodes = [...unlockedNodes, nodeId];

    // Calculate new bonuses
    const newBonuses = this.calculateBonuses(newUnlockedNodes);

    // Update character
    const newCharacter: Character = {
      ...character,
      divinationUnlocks: newUnlockedNodes,
      divinationUnlockBonuses: newBonuses,
    };

    // Update inventory maxSlots to reflect unlock bonuses
    const newMaxSlots = MAX_INVENTORY_SLOTS + (newBonuses.inventorySlots || 0);
    newInventory.maxSlots = newMaxSlots;

    return {
      success: true,
      character: newCharacter,
      inventory: newInventory,
    };
  }

  /**
   * Calculate aggregated bonuses from all unlocked nodes
   */
  static calculateBonuses(unlockedNodeIds: string[]): DivinationUnlockBonuses {
    const bonuses: DivinationUnlockBonuses = {};

    if (!this.unlockTreeCache) {
      return bonuses;
    }

    for (const nodeId of unlockedNodeIds) {
      const node = this.unlockTreeCache.find((n) => n.id === nodeId);
      if (!node || !node.bonuses) continue;

      const nodeBonuses = node.bonuses;

      // Aggregate stat bonuses
      if (nodeBonuses.statBonus) {
        if (!bonuses.statBonus) {
          bonuses.statBonus = {};
        }
        for (const [stat, value] of Object.entries(nodeBonuses.statBonus)) {
          if (value !== undefined) {
            bonuses.statBonus[stat as keyof typeof bonuses.statBonus] =
              (bonuses.statBonus[stat as keyof typeof bonuses.statBonus] || 0) + value;
          }
        }
      }

      // Aggregate combat stat bonuses
      if (nodeBonuses.combatStatBonus) {
        if (!bonuses.combatStatBonus) {
          bonuses.combatStatBonus = {};
        }
        for (const [stat, value] of Object.entries(nodeBonuses.combatStatBonus)) {
          if (value !== undefined) {
            bonuses.combatStatBonus[stat as keyof typeof bonuses.combatStatBonus] =
              (bonuses.combatStatBonus[stat as keyof typeof bonuses.combatStatBonus] || 0) + value;
          }
        }
      }

      // Aggregate combat multipliers (multiplicative)
      if (nodeBonuses.combatMultiplier) {
        if (!bonuses.combatMultiplier) {
          bonuses.combatMultiplier = {};
        }
        if (nodeBonuses.combatMultiplier.experience) {
          bonuses.combatMultiplier.experience =
            (bonuses.combatMultiplier.experience || 1) * nodeBonuses.combatMultiplier.experience;
        }
        if (nodeBonuses.combatMultiplier.gold) {
          bonuses.combatMultiplier.gold =
            (bonuses.combatMultiplier.gold || 1) * nodeBonuses.combatMultiplier.gold;
        }
        if (nodeBonuses.combatMultiplier.itemDropRate) {
          bonuses.combatMultiplier.itemDropRate =
            (bonuses.combatMultiplier.itemDropRate || 1) *
            nodeBonuses.combatMultiplier.itemDropRate;
        }
      }

      // Aggregate skill multipliers (multiplicative)
      if (nodeBonuses.skillMultiplier) {
        if (!bonuses.skillMultiplier) {
          bonuses.skillMultiplier = {};
        }
        if (nodeBonuses.skillMultiplier.experience) {
          bonuses.skillMultiplier.experience =
            (bonuses.skillMultiplier.experience || 1) * nodeBonuses.skillMultiplier.experience;
        }
        if (nodeBonuses.skillMultiplier.speed) {
          bonuses.skillMultiplier.speed =
            (bonuses.skillMultiplier.speed || 1) * nodeBonuses.skillMultiplier.speed;
        }
        if (nodeBonuses.skillMultiplier.yield) {
          bonuses.skillMultiplier.yield =
            (bonuses.skillMultiplier.yield || 1) * nodeBonuses.skillMultiplier.yield;
        }
      }

      // Aggregate inventory slots (additive)
      if (nodeBonuses.inventorySlots) {
        bonuses.inventorySlots = (bonuses.inventorySlots || 0) + nodeBonuses.inventorySlots;
      }

      // Aggregate offline time hours (additive)
      if (nodeBonuses.offlineTimeHours) {
        bonuses.offlineTimeHours = (bonuses.offlineTimeHours || 0) + nodeBonuses.offlineTimeHours;
      }

      // Aggregate max mercenaries (additive)
      if (nodeBonuses.maxMercenaries) {
        bonuses.maxMercenaries = (bonuses.maxMercenaries || 0) + nodeBonuses.maxMercenaries;
      }
    }

    return bonuses;
  }

  /**
   * Get unlock status for all nodes
   */
  static getUnlockStatus(
    character: Character,
    nodes: UnlockTreeNode[]
  ): Map<string, { unlocked: boolean; canUnlock: boolean; reason?: string }> {
    const unlockedNodes = character.divinationUnlocks || [];
    const status = new Map<string, { unlocked: boolean; canUnlock: boolean; reason?: string }>();

    for (const node of nodes) {
      const unlocked = unlockedNodes.includes(node.id);
      let canUnlock = false;
      let reason: string | undefined;

      if (unlocked) {
        canUnlock = false;
        reason = 'Already unlocked';
      } else {
        // Check skill level
        if (node.skillLevelRequirement) {
          const skillLevel = IdleSkillSystem.getSkillLevel(character, 'divination');
          if (skillLevel < node.skillLevelRequirement) {
            canUnlock = false;
            reason = `Requires divination level ${node.skillLevelRequirement}`;
          } else {
            canUnlock = true;
          }
        } else {
          canUnlock = true;
        }

        // Check prerequisites
        if (canUnlock && node.prerequisites && node.prerequisites.length > 0) {
          for (const prereqId of node.prerequisites) {
            if (!unlockedNodes.includes(prereqId)) {
              canUnlock = false;
              const prereqNode = nodes.find((n) => n.id === prereqId);
              reason = `Requires ${prereqNode?.name || prereqId}`;
              break;
            }
          }
        }
      }

      status.set(node.id, { unlocked, canUnlock, reason });
    }

    return status;
  }
}

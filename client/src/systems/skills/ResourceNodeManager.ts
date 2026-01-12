import type { Character, ResourceNode, Inventory } from '@idle-rpg/shared';
import { IdleSkillSystem } from './IdleSkillSystem';
import { UpgradeManager } from '../upgrade/UpgradeManager';

export interface GatheringResult {
  success: boolean;
  resources: Array<{ itemId: string; quantity: number }>;
  experience: number;
}

export class ResourceNodeManager {
  /**
   * Attempt to gather from a resource node
   */
  static gatherFromNode(
    character: Character,
    skillId: string,
    node: ResourceNode
  ): GatheringResult {
    const skillLevel = IdleSkillSystem.getSkillLevel(character, skillId);

    // Check if player has required level
    if (skillLevel < node.level) {
      return {
        success: false,
        resources: [],
        experience: 0,
      };
    }

    // Calculate success (base success rate + level bonus + upgrade bonus)
    const levelBonus = Math.min(skillLevel - node.level, 20) * 0.01; // +1% per level above requirement, max +20%
    const upgradeBonuses = UpgradeManager.getUpgradeBonuses(character, skillId);
    const successRate = Math.min(
      node.successRate + levelBonus + upgradeBonuses.successRateBonus,
      0.95
    ); // Cap at 95%
    const success = Math.random() <= successRate;

    if (!success) {
      return {
        success: false,
        resources: [],
        experience: Math.floor(node.experienceGain * 0.1), // Small exp for failed attempts
      };
    }

    // Generate resources
    const resources: Array<{ itemId: string; quantity: number }> = [];
    const resourceCounts: Record<string, number> = {};

    for (const drop of node.resources) {
      if (Math.random() <= drop.chance) {
        let quantity = 1;

        if (drop.min !== undefined && drop.max !== undefined) {
          quantity = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
        } else if (drop.quantity !== undefined) {
          quantity = drop.quantity;
        }

        resourceCounts[drop.itemId] = (resourceCounts[drop.itemId] || 0) + quantity;
      }
    }

    // Convert to array
    for (const [itemId, quantity] of Object.entries(resourceCounts)) {
      resources.push({ itemId, quantity });
    }

    return {
      success: true,
      resources,
      experience: node.experienceGain,
    };
  }

  /**
   * Get the best available resource node for a skill
   * @param inventory Optional inventory to check for unlock requirements
   */
  static getBestAvailableNode(character: Character, skillId: string, inventory?: Inventory): ResourceNode | null {
    const availableNodes = IdleSkillSystem.getAvailableResourceNodes(character, skillId, inventory);
    if (availableNodes.length === 0) {
      return null;
    }

    // Return the highest level node available
    return availableNodes.reduce((best, node) => {
      return node.level > best.level ? node : best;
    }, availableNodes[0]);
  }

  /**
   * Get all available nodes for a skill (sorted by level)
   * @param inventory Optional inventory to check for unlock requirements
   */
  static getAllAvailableNodes(character: Character, skillId: string, inventory?: Inventory): ResourceNode[] {
    return IdleSkillSystem.getAvailableResourceNodes(character, skillId, inventory).sort(
      (a, b) => a.level - b.level
    );
  }
}


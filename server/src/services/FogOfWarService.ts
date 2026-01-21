import { ParticipantPositionModel, type ParticipantPosition } from '../models/ParticipantPosition.js';
import { FloorConnectionModel } from '../models/FloorConnection.js';
import { MapService } from './MapService.js';
import { GameRulesService } from './GameRulesService.js';
import type { Character } from '@idle-rpg/shared';

export interface VisibilityModifier {
  visibilityRange: number; // Additional nodes visible beyond base
  revealAllNodes: boolean; // Reveal entire floor
  revealBossRooms: boolean; // Reveal all boss rooms
  revealConnections: boolean; // Reveal all connections
}

export interface FogOfWarResult {
  visibleNodes: string[]; // Node IDs that are visible
  exploredNodes: string[]; // Node IDs that have been explored
  adjacentNodes: string[]; // Node IDs adjacent to current position
  visibilityByNode: Map<string, 'explored' | 'adjacent' | 'hidden' | 'revealed'>; // Visibility state per node
}

export class FogOfWarService {
  /**
   * Calculate visible nodes for a participant with modifiers from items, abilities, and achievements
   */
  static async calculateVisibility(
    participantId: string,
    floorId: string,
    character?: Character | null,
    labyrinthId?: string
  ): Promise<FogOfWarResult> {
    // Get participant position
    const position = await ParticipantPositionModel.findByParticipantAndFloor(participantId, floorId);
    if (!position) {
      return {
        visibleNodes: [],
        exploredNodes: [],
        adjacentNodes: [],
        visibilityByNode: new Map(),
      };
    }

    // Get rules for this labyrinth
    const rules = labyrinthId
      ? await GameRulesService.getRulesForLabyrinth(labyrinthId)
      : GameRulesService.getGlobalRules();

    // Base visibility: explored nodes
    const exploredNodes = new Set<string>(position.explored_nodes || []);
    const visibleNodes = new Set<string>(position.explored_nodes || []);

    // Always include current node in visible nodes (even if not yet explored)
    if (position.current_node_id) {
      visibleNodes.add(position.current_node_id);
      // If not already explored, mark it as explored
      if (!exploredNodes.has(position.current_node_id)) {
        exploredNodes.add(position.current_node_id);
      }
    }

    // Add adjacent nodes to current position
    let adjacentNodes: string[] = [];
    if (position.current_node_id) {
      adjacentNodes = await FloorConnectionModel.getAdjacentNodes(position.current_node_id);
      adjacentNodes.forEach((nodeId) => {
        visibleNodes.add(nodeId);
      });
    }

    // Calculate modifiers from character (items, abilities, achievements)
    const modifier = character ? this.calculateModifier(character) : null;

    // Apply visibility range modifier
    if (modifier && modifier.visibilityRange > 0 && position.current_node_id) {
      const mapData = await MapService.buildMapData(floorId);
      const reachableNodes = await MapService.getReachableNodes(
        position.current_node_id,
        rules.fogOfWar.baseVisibility.visibilityRange + modifier.visibilityRange,
        mapData.connections
      );

      reachableNodes.forEach((nodeId) => {
        visibleNodes.add(nodeId);
      });
    }

    // Special modifiers
    if (modifier?.revealAllNodes) {
      // Reveal entire floor
      const mapData = await MapService.buildMapData(floorId);
      mapData.nodes.forEach((node) => {
        visibleNodes.add(node.id);
      });
    } else if (modifier?.revealBossRooms) {
      // Reveal all boss rooms
      const mapData = await MapService.buildMapData(floorId);
      mapData.metadata.bossRooms.forEach((nodeId) => {
        visibleNodes.add(nodeId);
      });
    }

    // Build visibility map
    const visibilityByNode = new Map<string, 'explored' | 'adjacent' | 'hidden' | 'revealed'>();
    
    // Load all nodes for the floor to check visibility
    const mapData = await MapService.buildMapData(floorId);
    for (const node of mapData.nodes) {
      if (exploredNodes.has(node.id)) {
        visibilityByNode.set(node.id, 'explored');
      } else if (adjacentNodes.includes(node.id)) {
        visibilityByNode.set(node.id, 'adjacent');
      } else if (visibleNodes.has(node.id)) {
        visibilityByNode.set(node.id, 'revealed');
      } else {
        visibilityByNode.set(node.id, 'hidden');
      }
    }

    return {
      visibleNodes: Array.from(visibleNodes),
      exploredNodes: Array.from(exploredNodes),
      adjacentNodes,
      visibilityByNode,
    };
  }

  /**
   * Calculate visibility modifiers from character's items, abilities, and achievements
   */
  private static calculateModifier(character: Character): VisibilityModifier {
    const modifier: VisibilityModifier = {
      visibilityRange: 0,
      revealAllNodes: false,
      revealBossRooms: false,
      revealConnections: false,
    };

    // Check equipment for visibility modifiers
    // Equipment items might have metadata with visibility bonuses
    if (character.equipment) {
      for (const [slot, itemId] of Object.entries(character.equipment)) {
        if (!itemId) continue;

        // Check for scouting items (would need to be defined in item metadata)
        // This is a placeholder - actual implementation would check item data
        const itemVisibilityBonus = this.getItemVisibilityBonus(itemId);
        if (itemVisibilityBonus) {
          modifier.visibilityRange += itemVisibilityBonus.visibilityRange || 0;
          modifier.revealBossRooms ||= itemVisibilityBonus.revealBossRooms || false;
          modifier.revealAllNodes ||= itemVisibilityBonus.revealAllNodes || false;
        }
      }
    }

    // Check learned skills for visibility abilities
    if (character.learnedSkills) {
      for (const learnedSkill of character.learnedSkills) {
        const skillVisibilityBonus = this.getSkillVisibilityBonus(learnedSkill.skillId);
        if (skillVisibilityBonus) {
          modifier.visibilityRange += skillVisibilityBonus.visibilityRange || 0;
          modifier.revealBossRooms ||= skillVisibilityBonus.revealBossRooms || false;
          modifier.revealAllNodes ||= skillVisibilityBonus.revealAllNodes || false;
        }
      }
    }

    // Check completed achievements for visibility bonuses
    if (character.completedAchievements) {
      for (const completedAchievement of character.completedAchievements) {
        const achievementVisibilityBonus = this.getAchievementVisibilityBonus(completedAchievement.achievementId);
        if (achievementVisibilityBonus) {
          modifier.visibilityRange += achievementVisibilityBonus.visibilityRange || 0;
          modifier.revealBossRooms ||= achievementVisibilityBonus.revealBossRooms || false;
          modifier.revealAllNodes ||= achievementVisibilityBonus.revealAllNodes || false;
          modifier.revealConnections ||= achievementVisibilityBonus.revealConnections || false;
        }
      }
    }

    return modifier;
  }

  /**
   * Get visibility bonus from an item (placeholder - would need item metadata)
   */
  private static getItemVisibilityBonus(itemId: string): Partial<VisibilityModifier> | null {
    // This is a placeholder implementation
    // In a real system, you would load item data and check for visibility modifiers
    // Items like "Scouting Crystal" might have metadata like:
    // { visibilityModifier: { visibilityRange: 2 } }

    // Example items that might provide visibility bonuses:
    const visibilityItems: Record<string, Partial<VisibilityModifier>> = {
      'scouting_crystal': { visibilityRange: 1 },
      'advanced_scouting_crystal': { visibilityRange: 2 },
      'map_of_labyrinth': { revealBossRooms: true },
      'master_map': { revealAllNodes: true },
    };

    return visibilityItems[itemId] || null;
  }

  /**
   * Get visibility bonus from a skill (placeholder - would need skill metadata)
   */
  private static getSkillVisibilityBonus(skillId: string): Partial<VisibilityModifier> | null {
    // This is a placeholder implementation
    // Skills like "Detect Hidden" might provide visibility bonuses

    const visibilitySkills: Record<string, Partial<VisibilityModifier>> = {
      'detect_hidden': { visibilityRange: 1 },
      'clairvoyance': { visibilityRange: 2, revealBossRooms: true },
      'omniscience': { revealAllNodes: true },
    };

    return visibilitySkills[skillId] || null;
  }

  /**
   * Get visibility bonus from an achievement (placeholder - would need achievement metadata)
   */
  private static getAchievementVisibilityBonus(achievementId: string): Partial<VisibilityModifier> | null {
    // This is a placeholder implementation
    // Achievements like "Explorer" might provide visibility bonuses

    const visibilityAchievements: Record<string, Partial<VisibilityModifier>> = {
      'explorer': { visibilityRange: 1 },
      'master_explorer': { visibilityRange: 2, revealBossRooms: true },
      'cartographer': { revealAllNodes: true, revealConnections: true },
    };

    return visibilityAchievements[achievementId] || null;
  }

  /**
   * Check if a connection should be visible based on visibility requirements
   */
  static async checkConnectionVisibility(
    connectionId: string,
    participantId: string,
    character?: Character | null
  ): Promise<boolean> {
    // Get connection
    const connection = await FloorConnectionModel.findById(connectionId);
    if (!connection) {
      return false;
    }

    // If no visibility requirement, connection is visible
    if (!connection.visibility_requirement) {
      return true;
    }

    // Check visibility requirements
    // This would check items, achievements, etc.
    // Placeholder implementation
    if (character) {
      // Example: Check if player has required item
      if (connection.visibility_requirement.requiredItem) {
        const requiredItem = connection.visibility_requirement.requiredItem;
        // Check if character has this item (would need to check inventory)
        // This is simplified - would need actual inventory checking
      }

      // Example: Check if player has required achievement
      if (connection.visibility_requirement.requiredAchievement) {
        const requiredAchievement = connection.visibility_requirement.requiredAchievement;
        const hasAchievement = character.completedAchievements?.some(
          (ca) => ca.achievementId === requiredAchievement
        );
        if (!hasAchievement) {
          return false;
        }
      }
    }

    return true;
  }
}
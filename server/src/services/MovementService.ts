import { ParticipantPositionModel, type ParticipantPosition } from '../models/ParticipantPosition.js';
import { FloorConnectionModel } from '../models/FloorConnection.js';
import { FloorNodeModel } from '../models/FloorNode.js';
import { LabyrinthFloorModel } from '../models/LabyrinthFloor.js';
import { LabyrinthParticipantModel } from '../models/LabyrinthParticipant.js';

export interface MovementResult {
  success: boolean;
  message?: string;
  newPosition?: ParticipantPosition;
  movementPointsRemaining?: number;
  revealedNodes?: string[];
}

export class MovementService {
  /**
   * Calculate regenerated movement points based on time elapsed
   */
  static calculateRegeneratedPoints(position: ParticipantPosition, regenRate: number): number {
    const now = new Date();
    const lastMovement = new Date(position.last_movement_time);
    const hoursElapsed = (now.getTime() - lastMovement.getTime()) / (1000 * 60 * 60);
    
    const regeneratedPoints = hoursElapsed * regenRate;
    const newTotal = Math.min(
      position.movement_points + regeneratedPoints,
      position.max_movement_points
    );
    
    return Math.floor(newTotal * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get current movement points with regeneration applied
   */
  static async getCurrentMovementPoints(
    participant_id: string,
    floor_id: string,
    regenRate: number
  ): Promise<number> {
    const position = await ParticipantPositionModel.findByParticipantAndFloor(participant_id, floor_id);
    if (!position) {
      throw new Error('Participant position not found');
    }

    const regenerated = this.calculateRegeneratedPoints(position, regenRate);
    
    // Update if regenerated points have increased
    if (regenerated > position.movement_points) {
      await ParticipantPositionModel.updateMovementPoints(participant_id, floor_id, regenerated);
    }

    return regenerated;
  }

  /**
   * Validate and execute movement between nodes
   */
  static async moveToNode(
    participant_id: string,
    floor_id: string,
    target_node_id: string,
    labyrinth_id?: string
  ): Promise<MovementResult> {
    // Get participant position
    const position = await ParticipantPositionModel.findByParticipantAndFloor(participant_id, floor_id);
    if (!position) {
      return { success: false, message: 'Position not found' };
    }

    // Get participant to get labyrinth_id if not provided
    if (!labyrinth_id) {
      const participant = await LabyrinthParticipantModel.findById(participant_id);
      if (participant) {
        labyrinth_id = participant.labyrinth_id;
      }
    }

    // Get floor configuration
    const floorResult = await LabyrinthFloorModel.findById(floor_id);
    if (!floorResult) {
      return { success: false, message: 'Floor not found' };
    }

    const regenRate = floorResult.movement_regen_rate || 1.0;
    
    // Calculate current movement points with regeneration
    let currentPoints = await this.getCurrentMovementPoints(participant_id, floor_id, regenRate);

    // Validate target node exists
    const targetNode = await FloorNodeModel.findById(target_node_id);
    if (!targetNode || targetNode.floor_id !== floor_id) {
      return { success: false, message: 'Invalid target node' };
    }

    // Check boss room locking (if moving TO a boss room)
    if (targetNode.node_type === 'boss') {
      const { BossRoomService } = await import('./BossRoomService.js');
      const canEnter = await BossRoomService.canEnterBossRoom(
        target_node_id,
        floor_id,
        participant_id,
        labyrinth_id
      );
      if (!canEnter.canEnter) {
        return { success: false, message: canEnter.reason || 'Cannot enter boss room' };
      }
    }

    // Check boss room locking (if moving FROM a boss room)
    if (position.current_node_id) {
      const currentNode = await FloorNodeModel.findById(position.current_node_id);
      if (currentNode && currentNode.node_type === 'boss') {
        const { BossRoomService } = await import('./BossRoomService.js');
        const canExit = await BossRoomService.canExitBossRoom(
          position.current_node_id,
          floor_id,
          participant_id,
          labyrinth_id
        );
        if (!canExit.canExit) {
          return { success: false, message: canExit.reason || 'Cannot exit boss room' };
        }
      }
    }

    // Check node capacity limits
    if (targetNode.capacity_limit !== null) {
      const playersOnNode = await ParticipantPositionModel.getPlayersOnNode(target_node_id);
      if (playersOnNode.length >= targetNode.capacity_limit) {
        return { success: false, message: 'Node is at capacity' };
      }
    }

    // Get current node
    if (!position.current_node_id) {
      // First movement - must start from a start point
      const startNodes = await FloorNodeModel.findStartNodesByFloorId(floor_id);
      const startNodeIds = startNodes.map(n => n.id);
      
      if (startNodeIds.length === 0) {
        // Fallback: allow starting from any node if no start points are marked
        // This handles edge cases where floors might not have start points set
      } else if (!startNodeIds.includes(target_node_id)) {
        return { success: false, message: 'Must start from a designated start point' };
      }
    } else {
      // Validate connection exists
      const canMove = await FloorConnectionModel.canMoveBetween(
        position.current_node_id,
        target_node_id
      );
      
      if (!canMove) {
        return { success: false, message: 'No path exists to target node' };
      }

      // Check connection visibility requirements
      const connections = await FloorConnectionModel.findByNodeId(position.current_node_id);
      const connection = connections.find(
        (c) => c.to_node_id === target_node_id || 
               (c.from_node_id === target_node_id && c.is_bidirectional)
      );
      
      // Check if connection has visibility requirements (would need character data)
      // This is a simplified check - full implementation would check items/achievements
      if (connection?.visibility_requirement) {
        // TODO: Check visibility requirements based on character items/achievements
        // For now, we'll allow it if the connection exists
      }

      // Get movement cost
      const movementCost = connection?.movement_cost || 1;

      // Check if player has enough movement points
      if (currentPoints < movementCost) {
        return { 
          success: false, 
          message: `Insufficient movement points. Need ${movementCost}, have ${currentPoints.toFixed(2)}` 
        };
      }

      currentPoints -= movementCost;
    }

    // Check if node requires exploration
    const isAlreadyExplored = position.explored_nodes.includes(target_node_id);

    // Update position
    const newExploredNodes = isAlreadyExplored 
      ? position.explored_nodes 
      : [...position.explored_nodes, target_node_id];

    // Get revealed adjacent nodes
    const adjacentNodes = await FloorConnectionModel.getAdjacentNodes(target_node_id);
    const revealedNodes = adjacentNodes.filter(nodeId => 
      !newExploredNodes.includes(nodeId) && 
      !position.explored_nodes.includes(nodeId)
    );

    // Determine movement cost and history based on whether this is first movement
    let movementCost = 0;
    let updatedHistory;

    if (position.current_node_id) {
      // Normal movement - get movement cost from connection
      const connections = await FloorConnectionModel.findByNodeId(position.current_node_id);
      const connection = connections.find(
        (c) => c.to_node_id === target_node_id || 
               (c.from_node_id === target_node_id && c.is_bidirectional)
      );
      movementCost = connection?.movement_cost || 1;

      updatedHistory = [
        ...position.movement_history,
        {
          node_id: target_node_id,
          timestamp: new Date().toISOString(),
          movement_cost: movementCost,
        },
      ];
    } else {
      // First movement - no cost
      movementCost = 0;
      updatedHistory = [{
        node_id: target_node_id,
        timestamp: new Date().toISOString(),
        movement_cost: 0,
      }];
    }

    // Check if moving into a boss room triggers locking
    if (targetNode.node_type === 'boss') {
      const { BossRoomService } = await import('./BossRoomService.js');
      const { GameRulesService } = await import('./GameRulesService.js');
      
      const rules = labyrinth_id
        ? await GameRulesService.getRulesForLabyrinth(labyrinth_id)
        : GameRulesService.getGlobalRules();

      // Check if boss room should lock on engagement
      if (rules.bossRoom.lockOnEngage) {
        // Lock the boss room when player enters
        await BossRoomService.lockBossRoom(target_node_id, floor_id, 'engaged');
      }

      // Check if boss room should lock on capacity
      if (rules.bossRoom.lockOnCapacity && targetNode.capacity_limit !== null) {
        const playersOnNode = await ParticipantPositionModel.getPlayersOnNode(target_node_id);
        if (playersOnNode.length + 1 >= targetNode.capacity_limit) {
          // Lock when capacity is reached (this player entering will reach capacity)
          await BossRoomService.lockBossRoom(target_node_id, floor_id, 'capacity');
        }
      }
    }

    const updatedPosition = await ParticipantPositionModel.updatePosition(participant_id, floor_id, {
      current_node_id: target_node_id,
      movement_points: currentPoints,
      explored_nodes: newExploredNodes,
      movement_history: updatedHistory.slice(-50), // Keep last 50 movements
    });

    if (!updatedPosition) {
      return { success: false, message: 'Failed to update position' };
    }

    // Check if target node is a combat area and prepare combat if needed
    if (targetNode.node_type === 'monster_spawn' || targetNode.node_type === 'boss') {
      const { CombatService } = await import('./CombatService.js');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _preparedCombat = await CombatService.prepareCombatForNode(
        target_node_id,
        floor_id,
        participant_id
      );
      
      // Note: Combat preparation is handled asynchronously
      // The client will receive COMBAT_PREPARED event via socket
      // Movement result doesn't include combat data to avoid circular dependencies
    }

    return {
      success: true,
      newPosition: updatedPosition,
      movementPointsRemaining: currentPoints,
      revealedNodes: revealedNodes,
    };
  }

  /**
   * Get visible nodes for a participant based on exploration
   */
  static async getVisibleNodes(participant_id: string, floor_id: string): Promise<string[]> {
    const position = await ParticipantPositionModel.findByParticipantAndFloor(participant_id, floor_id);
    if (!position) {
      return [];
    }

    const visibleNodes = new Set<string>(position.explored_nodes);

    // Add adjacent nodes to explored nodes (fog of war reveal)
    if (position.current_node_id) {
      const adjacentNodes = await FloorConnectionModel.getAdjacentNodes(position.current_node_id);
      adjacentNodes.forEach(nodeId => visibleNodes.add(nodeId));
    }

    return Array.from(visibleNodes);
  }

  /**
   * Initialize participant position when joining a floor
   * Uses equal distribution algorithm to assign start points
   */
  static async initializePosition(
    participant_id: string,
    floor_id: string,
    start_node_id: string | null, // Deprecated: kept for backward compatibility but ignored
    maxMovementPoints: number = 10,
    labyrinth_id?: string // Optional: for getting rules
  ): Promise<ParticipantPosition> {
    const existing = await ParticipantPositionModel.findByParticipantAndFloor(participant_id, floor_id);
    if (existing && existing.current_node_id) {
      return existing;
    }

    // Use StartPointService for equal distribution
    const { StartPointService } = await import('./StartPointService.js');
    const selectedStartNodeId = await StartPointService.assignStartPoint(
      participant_id,
      floor_id,
      labyrinth_id
    );

    // Fallback: if no start point assigned, try first available node
    let finalNodeId = selectedStartNodeId;
    if (!finalNodeId) {
      const allNodes = await FloorNodeModel.findByFloorId(floor_id);
      if (allNodes.length > 0) {
        finalNodeId = allNodes[0].id;
      } else {
        throw new Error(`No nodes found on floor ${floor_id}`);
      }
    }

    if (!finalNodeId) {
      throw new Error(`Failed to assign start point: no start points or nodes available on floor ${floor_id}`);
    }

    // If position exists but has no current_node_id, update it instead of creating a new one
    if (existing) {
      const updatedPosition = await ParticipantPositionModel.updatePosition(participant_id, floor_id, {
        current_node_id: finalNodeId,
        explored_nodes: [finalNodeId],
        movement_points: maxMovementPoints,
      });

      if (!updatedPosition || !updatedPosition.current_node_id) {
        throw new Error(`Failed to update participant position: current_node_id is still null for participant ${participant_id} on floor ${floor_id}`);
      }

      return updatedPosition;
    }

    // Create new position with start point marked as explored
    const position = await ParticipantPositionModel.create({
      participant_id,
      floor_id,
      current_node_id: finalNodeId,
      movement_points: maxMovementPoints,
      max_movement_points: maxMovementPoints,
    });

    if (!position) {
      throw new Error(`Failed to create participant position for participant ${participant_id} on floor ${floor_id}`);
    }

    // Mark the start point as explored so it's immediately visible
    if (finalNodeId) {
      await ParticipantPositionModel.updatePosition(participant_id, floor_id, {
        explored_nodes: [finalNodeId],
      });
    }

    // Return updated position with explored nodes
    const updatedPosition = await ParticipantPositionModel.findByParticipantAndFloor(participant_id, floor_id);
    if (!updatedPosition || !updatedPosition.current_node_id) {
      throw new Error(`Position was created but current_node_id is null for participant ${participant_id} on floor ${floor_id}`);
    }
    return updatedPosition || position;
  }
}

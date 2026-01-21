import { FloorNodeModel, type FloorNode } from '../models/FloorNode.js';
import { ParticipantPositionModel } from '../models/ParticipantPosition.js';
import { pool } from '../config/database.js';
import { GameRulesService } from './GameRulesService.js';

interface StartPointAssignment {
  nodeId: string;
  currentOccupancy: number;
  lastAssigned: Date | null;
}

export class StartPointService {
  private static assignmentCache: Map<string, StartPointAssignment[]> = new Map();

  /**
   * Assign a start point to a participant using equal distribution
   */
  static async assignStartPoint(
    participantId: string,
    floorId: string,
    labyrinthId?: string
  ): Promise<string | null> {
    // Get rules for this labyrinth
    const rules = labyrinthId
      ? await GameRulesService.getRulesForLabyrinth(labyrinthId)
      : GameRulesService.getGlobalRules();

    // Get all start points for this floor
    const startNodes = await FloorNodeModel.findStartNodesByFloorId(floorId);

    if (startNodes.length === 0) {
      // No start points marked, return null (fallback to any node or error)
      return null;
    }

    // Get current assignments from database (for persistence across server restarts)
    const currentAssignments = await this.getCurrentAssignments(floorId, startNodes);

    // Apply distribution algorithm
    let selectedNodeId: string | null = null;

    if (rules.startPoints.distributionAlgorithm === 'equal') {
      selectedNodeId = this.selectEqualDistribution(currentAssignments, rules.startPoints.preventOverlap);
    } else {
      // Random distribution (fallback)
      const randomIndex = Math.floor(Math.random() * startNodes.length);
      selectedNodeId = startNodes[randomIndex].id;
    }

    // Track assignment
    if (selectedNodeId) {
      await this.recordAssignment(floorId, selectedNodeId, participantId);
      
      // Update cache
      const cacheKey = floorId;
      if (!this.assignmentCache.has(cacheKey)) {
        this.assignmentCache.set(cacheKey, currentAssignments);
      } else {
        const cached = this.assignmentCache.get(cacheKey)!;
        const assignment = cached.find((a) => a.nodeId === selectedNodeId!);
        if (assignment) {
          assignment.currentOccupancy += 1;
          assignment.lastAssigned = new Date();
        }
      }
    }

    return selectedNodeId;
  }

  /**
   * Select start point using equal distribution algorithm
   */
  private static selectEqualDistribution(
    assignments: StartPointAssignment[],
    preventOverlap: boolean
  ): string {
    if (assignments.length === 0) {
      throw new Error('No start points available');
    }

    // Sort by occupancy (ascending), then by last assigned (ascending, nulls last)
    const sorted = [...assignments].sort((a, b) => {
      // First, sort by occupancy
      if (a.currentOccupancy !== b.currentOccupancy) {
        return a.currentOccupancy - b.currentOccupancy;
      }
      // If occupancy is equal, sort by last assigned (least recently assigned first)
      if (!a.lastAssigned && !b.lastAssigned) {
        return 0;
      }
      if (!a.lastAssigned) {
        return -1;
      }
      if (!b.lastAssigned) {
        return 1;
      }
      return a.lastAssigned.getTime() - b.lastAssigned.getTime();
    });

    // If preventing overlap, find first unoccupied start point
    if (preventOverlap) {
      const unoccupied = sorted.find((a) => a.currentOccupancy === 0);
      if (unoccupied) {
        return unoccupied.nodeId;
      }
    }

    // Otherwise, select the start point with lowest occupancy
    // If multiple have the same occupancy, select least recently assigned
    return sorted[0].nodeId;
  }

  /**
   * Get current assignments for start points on a floor
   */
  private static async getCurrentAssignments(
    floorId: string,
    startNodes: FloorNode[]
  ): Promise<StartPointAssignment[]> {
    // Check cache first
    const cacheKey = floorId;
    if (this.assignmentCache.has(cacheKey)) {
      // Verify cache is still valid by checking database
      const cached = this.assignmentCache.get(cacheKey)!;
      // For now, trust cache but we could add TTL or validation
      return cached;
    }

    // Query database for current assignments
    const assignments: StartPointAssignment[] = [];

    for (const node of startNodes) {
      // Count how many participants are currently on this start point
      const result = await pool.query(
        `SELECT COUNT(*) as count, MAX(created_at) as last_assigned
         FROM labyrinth_participant_positions
         WHERE floor_id = $1 AND current_node_id = $2`,
        [floorId, node.id]
      );

      const count = parseInt(result.rows[0]?.count || '0', 10);
      const lastAssigned = result.rows[0]?.last_assigned 
        ? new Date(result.rows[0].last_assigned)
        : null;

      assignments.push({
        nodeId: node.id,
        currentOccupancy: count,
        lastAssigned,
      });
    }

    // Cache assignments
    this.assignmentCache.set(cacheKey, assignments);

    return assignments;
  }

  /**
   * Record assignment of a start point to a participant
   */
  private static async recordAssignment(
    floorId: string,
    nodeId: string,
    participantId: string
  ): Promise<void> {
    // The assignment is recorded when ParticipantPosition is created
    // This method exists for future tracking/extensions
    // For now, we rely on the database queries in getCurrentAssignments

    // Update cache
    const cacheKey = floorId;
    if (this.assignmentCache.has(cacheKey)) {
      const cached = this.assignmentCache.get(cacheKey)!;
      const assignment = cached.find((a) => a.nodeId === nodeId);
      if (assignment) {
        assignment.currentOccupancy += 1;
        assignment.lastAssigned = new Date();
      }
    }
  }

  /**
   * Clear assignment cache for a floor (useful when floor resets)
   */
  static clearCache(floorId?: string): void {
    if (floorId) {
      this.assignmentCache.delete(floorId);
    } else {
      this.assignmentCache.clear();
    }
  }

  /**
   * Reset assignments for a floor (when floor resets or starts)
   */
  static async resetAssignments(floorId: string): Promise<void> {
    this.clearCache(floorId);
    // Database will be updated naturally as new participants join
  }
}
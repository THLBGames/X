import { FloorNodeModel, type FloorNode } from '../models/FloorNode.js';
import { FloorConnectionModel, type FloorConnection } from '../models/FloorConnection.js';
import { pool } from '../config/database.js';

export interface MapData {
  nodes: FloorNode[];
  connections: FloorConnection[];
  metadata: {
    bounds: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    };
    startPoints: string[]; // Node IDs
    bossRooms: string[]; // Node IDs
    stairNodes: string[]; // Node IDs
    specialNodes: {
      [nodeType: string]: string[]; // Node IDs by type
    };
  };
}

export interface MapNodeVisibility {
  nodeId: string;
  visibility: 'explored' | 'adjacent' | 'hidden';
  canMove: boolean; // Whether player can move to this node
  movementCost?: number; // Cost to move to this node from current position
}

export class MapService {
  /**
   * Filter map data to only include visible nodes and connections
   */
  static filterMapDataByVisibility(
    mapData: MapData,
    visibleNodeIds: Set<string>
  ): MapData {
    // Filter nodes to only include visible ones
    const visibleNodes = mapData.nodes.filter((node) => visibleNodeIds.has(node.id));

    // Filter connections to only include those where at least one endpoint is visible
    // This allows players to see connections to adjacent nodes even if the destination isn't fully explored
    const visibleConnections = mapData.connections.filter(
      (conn) =>
        visibleNodeIds.has(conn.from_node_id) || visibleNodeIds.has(conn.to_node_id)
    );

    // Recalculate bounds based on visible nodes
    const bounds = visibleNodes.length > 0 
      ? this.calculateBounds(visibleNodes)
      : mapData.metadata.bounds; // Fallback to original bounds if no visible nodes

    // Filter metadata to only include visible nodes
    const visibleStartPoints = mapData.metadata.startPoints.filter((id) =>
      visibleNodeIds.has(id)
    );
    const visibleBossRooms = mapData.metadata.bossRooms.filter((id) =>
      visibleNodeIds.has(id)
    );
    const visibleStairNodes = mapData.metadata.stairNodes.filter((id) =>
      visibleNodeIds.has(id)
    );

    const visibleSpecialNodes: Record<string, string[]> = {};
    for (const [nodeType, nodeIds] of Object.entries(mapData.metadata.specialNodes)) {
      const filtered = nodeIds.filter((id) => visibleNodeIds.has(id));
      if (filtered.length > 0) {
        visibleSpecialNodes[nodeType] = filtered;
      }
    }

    return {
      nodes: visibleNodes,
      connections: visibleConnections,
      metadata: {
        bounds,
        startPoints: visibleStartPoints,
        bossRooms: visibleBossRooms,
        stairNodes: visibleStairNodes,
        specialNodes: visibleSpecialNodes,
      },
    };
  }

  /**
   * Build map data structure from database for a specific floor
   */
  static async buildMapData(floorId: string): Promise<MapData> {
    // Load all nodes for the floor
    const nodes = await FloorNodeModel.findByFloorId(floorId);

    // Load all connections for the floor
    const connections = await FloorConnectionModel.findByFloorId(floorId);

    // Calculate bounds
    const bounds = this.calculateBounds(nodes);

    // Identify special nodes
    const startPoints: string[] = [];
    const bossRooms: string[] = [];
    const stairNodes: string[] = [];
    const specialNodes: Record<string, string[]> = {};

    for (const node of nodes) {
      if (node.is_start_point) {
        startPoints.push(node.id);
      }
      if (node.node_type === 'boss') {
        bossRooms.push(node.id);
      }
      if (node.node_type === 'stairs') {
        stairNodes.push(node.id);
      }
      
      // Group by node type
      if (!specialNodes[node.node_type]) {
        specialNodes[node.node_type] = [];
      }
      specialNodes[node.node_type].push(node.id);
    }

    return {
      nodes,
      connections,
      metadata: {
        bounds,
        startPoints,
        bossRooms,
        stairNodes,
        specialNodes,
      },
    };
  }

  /**
   * Calculate map bounds from nodes
   */
  private static calculateBounds(nodes: FloorNode[]): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    if (nodes.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    let minX = nodes[0].x_coordinate;
    let maxX = nodes[0].x_coordinate;
    let minY = nodes[0].y_coordinate;
    let maxY = nodes[0].y_coordinate;

    for (const node of nodes) {
      minX = Math.min(minX, node.x_coordinate);
      maxX = Math.max(maxX, node.x_coordinate);
      minY = Math.min(minY, node.y_coordinate);
      maxY = Math.max(maxY, node.y_coordinate);
    }

    return { minX, maxX, minY, maxY };
  }

  /**
   * Build adjacency graph from connections
   */
  static buildAdjacencyGraph(connections: FloorConnection[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const connection of connections) {
      // Add forward connection
      if (!graph.has(connection.from_node_id)) {
        graph.set(connection.from_node_id, []);
      }
      if (!graph.get(connection.from_node_id)!.includes(connection.to_node_id)) {
        graph.get(connection.from_node_id)!.push(connection.to_node_id);
      }

      // Add reverse connection if bidirectional
      if (connection.is_bidirectional) {
        if (!graph.has(connection.to_node_id)) {
          graph.set(connection.to_node_id, []);
        }
        if (!graph.get(connection.to_node_id)!.includes(connection.from_node_id)) {
          graph.get(connection.to_node_id)!.push(connection.from_node_id);
        }
      }
    }

    return graph;
  }

  /**
   * Get adjacent nodes for a given node
   */
  static async getAdjacentNodes(nodeId: string): Promise<string[]> {
    return await FloorConnectionModel.getAdjacentNodes(nodeId);
  }

  /**
   * Check if path exists between two nodes
   */
  static async canMoveBetween(fromNodeId: string, toNodeId: string): Promise<boolean> {
    return await FloorConnectionModel.canMoveBetween(fromNodeId, toNodeId);
  }

  /**
   * Get movement cost between two nodes
   */
  static async getMovementCost(fromNodeId: string, toNodeId: string): Promise<number> {
    const connections = await FloorConnectionModel.findByNodes(fromNodeId, toNodeId);
    if (!connections) {
      return 1; // Default cost
    }
    return connections.movement_cost || 1;
  }

  /**
   * Find path between two nodes using BFS
   */
  static async findPath(
    fromNodeId: string,
    toNodeId: string,
    connections: FloorConnection[]
  ): Promise<string[] | null> {
    if (fromNodeId === toNodeId) {
      return [fromNodeId];
    }

    const graph = this.buildAdjacencyGraph(connections);
    const visited = new Set<string>();
    const queue: Array<{ node: string; path: string[] }> = [{ node: fromNodeId, path: [fromNodeId] }];

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;

      if (node === toNodeId) {
        return path;
      }

      if (visited.has(node)) {
        continue;
      }

      visited.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push({ node: neighbor, path: [...path, neighbor] });
        }
      }
    }

    return null; // No path found
  }

  /**
   * Get all nodes reachable from a starting node (for pathfinding/visibility)
   */
  static async getReachableNodes(
    startNodeId: string,
    maxDepth: number,
    connections: FloorConnection[]
  ): Promise<Set<string>> {
    const graph = this.buildAdjacencyGraph(connections);
    const reachable = new Set<string>();
    const queue: Array<{ node: string; depth: number }> = [{ node: startNodeId, depth: 0 }];

    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;

      if (depth > maxDepth) {
        continue;
      }

      if (reachable.has(node)) {
        continue;
      }

      reachable.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!reachable.has(neighbor) && depth < maxDepth) {
          queue.push({ node: neighbor, depth: depth + 1 });
        }
      }
    }

    return reachable;
  }

  /**
   * Get nodes with players currently on them
   */
  static async getNodesWithPlayers(floorId: string): Promise<Map<string, number>> {
    // Get all positions for this floor with non-null node IDs
    const result = await pool.query(
      `SELECT current_node_id, COUNT(*) as count 
       FROM labyrinth_participant_positions 
       WHERE floor_id = $1 AND current_node_id IS NOT NULL 
       GROUP BY current_node_id`,
      [floorId]
    );
    
    // Count players per node
    const nodeCounts = new Map<string, number>();
    for (const row of result.rows) {
      nodeCounts.set(row.current_node_id, parseInt(row.count, 10));
    }

    return nodeCounts;
  }
}
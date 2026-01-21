import { FloorNodeModel, type FloorNode, type NodeType } from '../models/FloorNode.js';
import { FloorConnectionModel, type FloorConnection } from '../models/FloorConnection.js';

export interface ProceduralGenerationConfig {
  floor_id: string;
  totalNodes: number;
  bossCount: number;
  safeZoneCount: number;
  craftingCount: number;
  stairCount: number;
  startPointCount?: number; // Number of start points to create (default: 1)
  layoutType: 'maze' | 'hub_spoke' | 'linear' | 'random';
  connectionDensity: number; // 0-1, higher = more connections
}

export interface GeneratedLayout {
  nodes: FloorNode[];
  connections: FloorConnection[];
}

export class ProceduralGenerator {
  /**
   * Generate a complete floor layout based on configuration
   */
  static async generateFloorLayout(config: ProceduralGenerationConfig): Promise<GeneratedLayout> {
    switch (config.layoutType) {
      case 'maze':
        return await this.generateMazeLayout(config);
      case 'hub_spoke':
        return await this.generateHubSpokeLayout(config);
      case 'linear':
        return await this.generateLinearLayout(config);
      case 'random':
        return await this.generateRandomLayout(config);
      default:
        return await this.generateMazeLayout(config);
    }
  }

  /**
   * Generate a maze-like layout with guaranteed paths
   */
  private static async generateMazeLayout(config: ProceduralGenerationConfig): Promise<GeneratedLayout> {
    const nodes: FloorNode[] = [];
    const connections: FloorConnection[] = [];

    // Generate nodes
    const gridSize = Math.ceil(Math.sqrt(config.totalNodes));
    const nodePositions: Array<{ x: number; y: number; id?: string }> = [];

    // Create grid positions
    for (let i = 0; i < config.totalNodes; i++) {
      const x = (i % gridSize) * 200;
      const y = Math.floor(i / gridSize) * 200;
      nodePositions.push({ x, y });
    }

    // Place entrance node (not necessarily a start point)
    const entranceNode = await FloorNodeModel.create({
      floor_id: config.floor_id,
      node_type: 'regular',
      x_coordinate: nodePositions[0].x,
      y_coordinate: nodePositions[0].y,
      name: 'Entrance',
      is_revealed: true,
      is_start_point: false, // Will be set later if selected
    });
    nodes.push(entranceNode);
    nodePositions[0].id = entranceNode.id;

    // Track used indices to avoid duplicates
    const usedIndices = new Set<number>([0]); // Entrance node is at index 0

    // Place stairs (guaranteed accessible)
    const stairIndices = this.selectRandomIndices(
      config.stairCount,
      config.totalNodes - 1,
      Array.from(usedIndices)
    );
    stairIndices.forEach(idx => usedIndices.add(idx));
    for (const idx of stairIndices) {
      const stairNode = await FloorNodeModel.create({
        floor_id: config.floor_id,
        node_type: 'stairs',
        x_coordinate: nodePositions[idx].x,
        y_coordinate: nodePositions[idx].y,
        name: `Stairs to Next Floor`,
        leads_to_floor_number: null, // Set by admin
        is_revealed: false,
      });
      nodes.push(stairNode);
      nodePositions[idx].id = stairNode.id;
    }

    // Place boss nodes
    const bossIndices = this.selectRandomIndices(
      config.bossCount,
      config.totalNodes - 1,
      Array.from(usedIndices)
    );
    bossIndices.forEach(idx => usedIndices.add(idx));
    for (const idx of bossIndices) {
      const bossNode = await FloorNodeModel.create({
        floor_id: config.floor_id,
        node_type: 'boss',
        x_coordinate: nodePositions[idx].x,
        y_coordinate: nodePositions[idx].y,
        name: 'Boss Chamber',
        is_revealed: false,
      });
      nodes.push(bossNode);
      nodePositions[idx].id = bossNode.id;
    }

    // Place safe zones
    const safeIndices = this.selectRandomIndices(
      config.safeZoneCount,
      config.totalNodes - 1,
      Array.from(usedIndices)
    );
    safeIndices.forEach(idx => usedIndices.add(idx));
    for (const idx of safeIndices) {
      const safeNode = await FloorNodeModel.create({
        floor_id: config.floor_id,
        node_type: 'safe_zone',
        x_coordinate: nodePositions[idx].x,
        y_coordinate: nodePositions[idx].y,
        name: 'Safe Haven',
        is_revealed: false,
      });
      nodes.push(safeNode);
      nodePositions[idx].id = safeNode.id;
    }

    // Place crafting areas
    const craftingIndices = this.selectRandomIndices(
      config.craftingCount,
      config.totalNodes - 1,
      Array.from(usedIndices)
    );
    craftingIndices.forEach(idx => usedIndices.add(idx));
    for (const idx of craftingIndices) {
      const craftingNode = await FloorNodeModel.create({
        floor_id: config.floor_id,
        node_type: 'crafting',
        x_coordinate: nodePositions[idx].x,
        y_coordinate: nodePositions[idx].y,
        name: 'Crafting Station',
        is_revealed: false,
      });
      nodes.push(craftingNode);
      nodePositions[idx].id = craftingNode.id;
    }

    // Fill remaining with monster spawns
    for (let i = 1; i < config.totalNodes; i++) {
      if (nodePositions[i].id) continue;

      const node = await FloorNodeModel.create({
        floor_id: config.floor_id,
        node_type: 'monster_spawn',
        x_coordinate: nodePositions[i].x,
        y_coordinate: nodePositions[i].y,
        name: `Room ${i}`,
        is_revealed: false,
      });
      nodes.push(node);
      nodePositions[i].id = node.id;
    }

    // Mark start points (randomly selected from all nodes)
    const startPointCount = config.startPointCount ?? 1; // Default to 1 if not specified
    const actualStartPointCount = Math.min(Math.max(1, startPointCount), nodes.length); // Ensure between 1 and total nodes
    
    // Select random nodes to be start points
    const availableNodeIndices = Array.from({ length: nodes.length }, (_, i) => i);
    const shuffled = [...availableNodeIndices].sort(() => Math.random() - 0.5);
    const selectedIndices = shuffled.slice(0, actualStartPointCount);
    
    // Mark selected nodes as start points
    for (const idx of selectedIndices) {
      const node = nodes[idx];
      if (node) {
        await FloorNodeModel.update(node.id, { is_start_point: true });
        // Update in our local array
        node.is_start_point = true;
      }
    }

    // Create connections (minimum spanning tree + additional based on density)
    const connected = new Set<string>([entranceNode.id]);
    const toConnect = nodes.filter(n => n.id !== entranceNode.id).map(n => n.id);

    // Build minimum spanning tree (guarantees all nodes reachable)
    while (toConnect.length > 0) {
      const randomConnected = Array.from(connected)[
        Math.floor(Math.random() * connected.size)
      ];
      const randomUnconnected = toConnect[Math.floor(Math.random() * toConnect.length)];

      const conn = await FloorConnectionModel.create({
        floor_id: config.floor_id,
        from_node_id: randomConnected,
        to_node_id: randomUnconnected,
        is_bidirectional: true,
        movement_cost: 1,
      });
      connections.push(conn);

      connected.add(randomUnconnected);
      toConnect.splice(toConnect.indexOf(randomUnconnected), 1);
    }

    // Add additional connections based on density
    const additionalConnections = Math.floor(
      (config.totalNodes * (config.connectionDensity - 0.3)) / 2
    );
    for (let i = 0; i < additionalConnections; i++) {
      const node1 = nodes[Math.floor(Math.random() * nodes.length)];
      const node2 = nodes[Math.floor(Math.random() * nodes.length)];
      
      if (node1.id === node2.id) continue;

      // Check if connection already exists
      const exists = connections.some(
        (c) =>
          (c.from_node_id === node1.id && c.to_node_id === node2.id) ||
          (c.from_node_id === node2.id && c.to_node_id === node1.id)
      );

      if (!exists) {
        const conn = await FloorConnectionModel.create({
          floor_id: config.floor_id,
          from_node_id: node1.id,
          to_node_id: node2.id,
          is_bidirectional: true,
          movement_cost: 1,
        });
        connections.push(conn);
      }
    }

    return { nodes, connections };
  }

  /**
   * Generate hub-and-spoke layout
   */
  private static async generateHubSpokeLayout(config: ProceduralGenerationConfig): Promise<GeneratedLayout> {
    // Simplified implementation - similar structure but organized around hubs
    return await this.generateMazeLayout(config);
  }

  /**
   * Generate linear progression layout
   */
  private static async generateLinearLayout(config: ProceduralGenerationConfig): Promise<GeneratedLayout> {
    // Simplified implementation - chain of nodes
    return await this.generateMazeLayout(config);
  }

  /**
   * Generate completely random layout
   */
  private static async generateRandomLayout(config: ProceduralGenerationConfig): Promise<GeneratedLayout> {
    return await this.generateMazeLayout(config);
  }

  /**
   * Select random indices excluding certain values
   */
  private static selectRandomIndices(count: number, max: number, exclude: number[]): number[] {
    const available = Array.from({ length: max }, (_, i) => i + 1).filter(
      (i) => !exclude.includes(i)
    );
    const selected: number[] = [];
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      selected.push(shuffled[i]);
    }
    
    return selected;
  }
}

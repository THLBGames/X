import { FloorNodeModel, type FloorNode } from '../models/FloorNode.js';
import { FloorConnectionModel, type FloorConnection } from '../models/FloorConnection.js';
import { LabyrinthFloorModel } from '../models/LabyrinthFloor.js';
import { MonsterModel } from '../models/Monster.js';

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
  poiWaveCombatEnabled?: boolean; // Enable POI wave combat generation (default: false)
  poiWaveCombatPercentage?: number; // Percentage of monster_spawn nodes that get waves (0-1, default: 0.5)
  poiWaveConfig?: {
    minWaves: number;
    maxWaves: number;
    minMonstersPerWave: number;
    maxMonstersPerWave: number;
  }; // Wave configuration ranges (default: { minWaves: 2, maxWaves: 4, minMonstersPerWave: 2, maxMonstersPerWave: 5 })
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

    // Get floor monster pool for POI combat generation
    const floor = await LabyrinthFloorModel.findById(config.floor_id);
    const floorMonsterPool = floor?.monster_pool || [];
    const floorNumber = floor?.floor_number || 1;

    // Fill remaining with monster spawns
    // Determine POI wave config defaults
    const poiWaveCombatEnabled = config.poiWaveCombatEnabled ?? false;
    const poiWaveCombatPercentage = config.poiWaveCombatPercentage ?? 0.5;
    
    // Log if POI combat is enabled but floor has no monster pool (we'll generate a default one)
    if (poiWaveCombatEnabled && floorMonsterPool.length === 0) {
      console.log(
        `[ProceduralGenerator] POI combat is enabled but floor ${config.floor_id} has no monster pool. ` +
        `Will generate default monster pool from available monsters in database.`
      );
    }
    const defaultWaveConfig = {
      minWaves: 2,
      maxWaves: 4,
      minMonstersPerWave: 2,
      maxMonstersPerWave: 5,
    };
    const waveConfig = config.poiWaveConfig ?? defaultWaveConfig;

    for (let i = 1; i < config.totalNodes; i++) {
      if (nodePositions[i].id) continue;

      // Determine if this node should have POI waves
      const metadata: Record<string, any> = {};
      let nodeMonsterPool: any[] | null = null;
      
      if (poiWaveCombatEnabled && Math.random() < poiWaveCombatPercentage) {
        // Generate POI wave config for this node with monster pools
        metadata.poi_combat = await this.generatePOIWaveConfig(
          waveConfig.minWaves,
          waveConfig.maxWaves,
          waveConfig.minMonstersPerWave,
          waveConfig.maxMonstersPerWave,
          floorMonsterPool,
          floorNumber
        );
        
        // Extract monster pool from first wave if available (for display purposes)
        if (metadata.poi_combat?.waves?.[0]?.monsterPool) {
          nodeMonsterPool = metadata.poi_combat.waves[0].monsterPool;
        }
      } else {
        // For non-POI combat nodes, ensure they have a monster pool in metadata
        // Use floor's pool if available, otherwise generate default
        if (floorMonsterPool.length > 0) {
          nodeMonsterPool = floorMonsterPool;
        } else {
          nodeMonsterPool = await this.generateDefaultMonsterPool(floorNumber);
        }
        
        // Add monster pool to metadata for regular combat nodes
        if (nodeMonsterPool.length > 0) {
          metadata.monster_pool = nodeMonsterPool;
        }
      }

      // Create node with metadata - ensure metadata is always an object
      const nodeMetadata = Object.keys(metadata).length > 0 ? metadata : {};
      
      const node = await FloorNodeModel.create({
        floor_id: config.floor_id,
        node_type: 'monster_spawn',
        x_coordinate: nodePositions[i].x,
        y_coordinate: nodePositions[i].y,
        name: `Room ${i}`,
        is_revealed: false,
        metadata: nodeMetadata,
      });
      
      // Log node creation with combat type
      if (nodeMetadata.poi_combat?.enabled) {
        const wavesCount = nodeMetadata.poi_combat.waves?.length || 0;
        const wavesWithMonsterPool = nodeMetadata.poi_combat.waves?.filter(w => w.monsterPool && w.monsterPool.length > 0).length || 0;
        console.log(`[ProceduralGenerator] Created node ${node.id} with POI combat: ${wavesCount} waves (${wavesWithMonsterPool} with monster pools)`);
        // Log a sample wave to verify monsterPool is included
        if (nodeMetadata.poi_combat.waves && nodeMetadata.poi_combat.waves.length > 0) {
          const sampleWave = nodeMetadata.poi_combat.waves[0];
          console.log(`[ProceduralGenerator] Sample wave:`, {
            waveNumber: sampleWave.waveNumber,
            monsterCount: sampleWave.monsterCount,
            hasMonsterPool: !!sampleWave.monsterPool,
            monsterPoolSize: sampleWave.monsterPool?.length || 0,
          });
        }
      } else if (nodeMetadata.monster_pool) {
        console.log(`[ProceduralGenerator] Created node ${node.id} with regular combat pool: ${nodeMetadata.monster_pool.length} monsters`);
      } else {
        console.warn(`[ProceduralGenerator] Created node ${node.id} without any monster pool!`);
      }
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

  /**
   * Generate a default monster pool from available monsters in the database
   */
  private static async generateDefaultMonsterPool(floorNumber: number = 1): Promise<any[]> {
    try {
      // Try to get monsters by tier (lower tier for lower floors)
      // Floor 1 = tier 1, Floor 2 = tier 1-2, Floor 3+ = tier 1-3
      const maxTier = Math.min(3, Math.max(1, Math.floor(floorNumber / 2) + 1));
      
      let monsters;
      if (maxTier === 1) {
        monsters = await MonsterModel.listByTier(1);
      } else {
        // Get monsters from multiple tiers
        const allMonsters = await MonsterModel.listAll();
        monsters = allMonsters.filter(m => m.tier <= maxTier);
      }
      
      if (monsters.length === 0) {
        // Fallback: get all monsters if tier filtering returns nothing
        monsters = await MonsterModel.listAll();
      }
      
      if (monsters.length === 0) {
        console.warn('[ProceduralGenerator] No monsters found in database for default pool');
        return [];
      }
      
      // Create a monster pool from available monsters
      // Use a subset of monsters (5-10 monsters) with equal weights
      const poolSize = Math.min(10, Math.max(5, monsters.length));
      const selectedMonsters = monsters.slice(0, poolSize);
      
      const monsterPool = selectedMonsters.map(monster => ({
        monsterId: monster.id, // Use monsterId to match MonsterSpawnService interface
        weight: 1, // Equal weight for all monsters
        minLevel: Math.max(1, monster.level - 2), // Allow some level variation
        maxLevel: monster.level + 2,
      }));
      
      console.log(`[ProceduralGenerator] Generated default monster pool with ${monsterPool.length} monsters (tier <= ${maxTier})`);
      return monsterPool;
    } catch (error) {
      console.error('[ProceduralGenerator] Error generating default monster pool:', error);
      return [];
    }
  }

  /**
   * Generate POI wave combat configuration with monster pools
   */
  private static async generatePOIWaveConfig(
    minWaves: number,
    maxWaves: number,
    minMonstersPerWave: number,
    maxMonstersPerWave: number,
    floorMonsterPool: any[],
    floorNumber: number = 1
  ): Promise<{ enabled: true; waves: Array<{ waveNumber: number; monsterCount: number; monsterPool?: any[] }> }> {
    // Generate random number of waves within range
    const numWaves = Math.floor(Math.random() * (maxWaves - minWaves + 1)) + minWaves;
    
    const waves: Array<{ waveNumber: number; monsterCount: number; monsterPool?: any[] }> = [];
    
    // Determine monster pool to use
    let baseMonsterPool: any[];
    if (floorMonsterPool.length > 0) {
      baseMonsterPool = floorMonsterPool;
      console.log(`[ProceduralGenerator] Using floor's monster pool (${baseMonsterPool.length} monsters)`);
    } else {
      // Generate default monster pool from database
      baseMonsterPool = await this.generateDefaultMonsterPool(floorNumber);
      if (baseMonsterPool.length === 0) {
        console.warn('[ProceduralGenerator] Could not generate default monster pool, POI combat may fail');
      } else {
        console.log(`[ProceduralGenerator] Generated default monster pool (${baseMonsterPool.length} monsters) for floor ${floorNumber}`);
      }
    }
    
    // Generate each wave
    for (let i = 1; i <= numWaves; i++) {
      // Generate random monster count for this wave
      const monsterCount = Math.floor(Math.random() * (maxMonstersPerWave - minMonstersPerWave + 1)) + minMonstersPerWave;
      
      // Use the base monster pool for all waves
      // Could also create variations (e.g., harder monsters in later waves) but for now use the same pool
      waves.push({
        waveNumber: i,
        monsterCount,
        monsterPool: baseMonsterPool.length > 0 ? baseMonsterPool : undefined,
      });
    }
    
    return {
      enabled: true,
      waves,
    };
  }
}

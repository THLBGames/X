import type { FloorNode, FloorConnection } from '@idle-rpg/shared';

/**
 * Validate floor layout for solvability and correctness
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that the floor layout is solvable and correctly configured
 */
export function validateFloorLayout(
  nodes: FloorNode[],
  connections: FloorConnection[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for at least one start point
  const startNodes = nodes.filter(n => n.is_start_point);
  if (startNodes.length === 0) {
    warnings.push('No start point found. Players need at least one node marked as a start point.');
  }

  // Check for at least one stairs node
  const stairsNodes = nodes.filter(n => n.node_type === 'stairs');
  if (stairsNodes.length === 0) {
    errors.push('No stairs node found. Floor must have at least one exit.');
  }

  // Check that all stairs have target floor numbers
  for (const stair of stairsNodes) {
    if (stair.leads_to_floor_number === null || stair.leads_to_floor_number === undefined) {
      warnings.push(`Stairs node "${stair.name || stair.id}" does not have a target floor number.`);
    }
  }

  // Build adjacency map for path checking
  const adjacencyMap = new Map<string, string[]>();
  for (const node of nodes) {
    adjacencyMap.set(node.id, []);
  }

  for (const conn of connections) {
    const fromAdj = adjacencyMap.get(conn.from_node_id);
    if (fromAdj && !fromAdj.includes(conn.to_node_id)) {
      fromAdj.push(conn.to_node_id);
    }

    if (conn.is_bidirectional) {
      const toAdj = adjacencyMap.get(conn.to_node_id);
      if (toAdj && !toAdj.includes(conn.from_node_id)) {
        toAdj.push(conn.from_node_id);
      }
    }
  }

  // Check if all nodes are reachable from at least one start point
  if (startNodes.length > 0) {
    // Check reachability from all start points
    const allReachable = new Set<string>();
    
    for (const startNode of startNodes) {
      const reachable = new Set<string>();
      const queue = [startNode.id];
      reachable.add(startNode.id);

      while (queue.length > 0) {
        const current = queue.shift()!;
        const adjacents = adjacencyMap.get(current) || [];
        for (const adj of adjacents) {
          if (!reachable.has(adj)) {
            reachable.add(adj);
            queue.push(adj);
          }
        }
      }
      
      // Merge into all reachable set
      reachable.forEach(id => allReachable.add(id));
    }

    const unreachable = nodes.filter(n => !allReachable.has(n.id));
    if (unreachable.length > 0) {
      errors.push(
        `${unreachable.length} node(s) are not reachable from any start point: ${unreachable.map(n => n.name || n.id).join(', ')}`
      );
    }

    // Check if stairs are reachable
    const unreachableStairs = stairsNodes.filter(s => !allReachable.has(s.id));
    if (unreachableStairs.length > 0) {
      errors.push(
        `${unreachableStairs.length} stairs node(s) are not reachable from any start point: ${unreachableStairs.map(s => s.name || s.id).join(', ')}`
      );
    }
  }

  // Check for orphaned nodes (no connections)
  const nodesWithConnections = new Set<string>();
  for (const conn of connections) {
    nodesWithConnections.add(conn.from_node_id);
    nodesWithConnections.add(conn.to_node_id);
  }
  const orphanedNodes = nodes.filter(n => !nodesWithConnections.has(n.id));
  if (orphanedNodes.length > 0 && nodes.length > 1) {
    warnings.push(
      `${orphanedNodes.length} node(s) have no connections: ${orphanedNodes.map(n => n.name || n.id).join(', ')}`
    );
  }

  // Check for nodes at same coordinates
  const coordinateMap = new Map<string, FloorNode[]>();
  for (const node of nodes) {
    const key = `${node.x_coordinate},${node.y_coordinate}`;
    if (!coordinateMap.has(key)) {
      coordinateMap.set(key, []);
    }
    coordinateMap.get(key)!.push(node);
  }

  for (const [key, nodesAtCoord] of coordinateMap) {
    if (nodesAtCoord.length > 1) {
      warnings.push(
        `${nodesAtCoord.length} nodes share the same coordinates (${key}): ${nodesAtCoord.map(n => n.name || n.id).join(', ')}`
      );
    }
  }

  // Check boss nodes have valid configuration
  const bossNodes = nodes.filter(n => n.node_type === 'boss');
  for (const boss of bossNodes) {
    if (!boss.metadata?.boss_config?.monster_id) {
      warnings.push(`Boss node "${boss.name || boss.id}" does not have a monster_id configured.`);
    }
  }

  // Check spawner nodes have valid configuration
  const spawnerNodes = nodes.filter(n => n.node_type === 'monster_spawner');
  for (const spawner of spawnerNodes) {
    if (!spawner.metadata?.spawner_config?.monster_pool || 
        !Array.isArray(spawner.metadata.spawner_config.monster_pool) ||
        spawner.metadata.spawner_config.monster_pool.length === 0) {
      warnings.push(`Spawner node "${spawner.name || spawner.id}" does not have a valid monster_pool configured.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

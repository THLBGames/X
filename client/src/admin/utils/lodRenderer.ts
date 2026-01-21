import type { FloorNode } from '@idle-rpg/shared';

/**
 * Level-of-detail rendering utilities
 */

export interface ClusterNode {
  type: 'single' | 'cluster';
  node?: FloorNode;
  nodes?: FloorNode[];
  x: number;
  y: number;
  count?: number;
}

/**
 * Cluster nodes for LOD rendering
 */
export function clusterNodes(
  nodes: FloorNode[],
  clusterRadius: number
): ClusterNode[] {
  const clusters: ClusterNode[] = [];
  const processed = new Set<string>();

  for (const node of nodes) {
    if (processed.has(node.id)) continue;

    // Find nearby nodes
    const nearby = nodes.filter(n => {
      if (processed.has(n.id)) return false;
      const dist = Math.sqrt(
        Math.pow(n.x_coordinate - node.x_coordinate, 2) +
        Math.pow(n.y_coordinate - node.y_coordinate, 2)
      );
      return dist <= clusterRadius;
    });

    if (nearby.length === 1) {
      // Single node
      clusters.push({
        type: 'single',
        node: nearby[0],
        x: nearby[0].x_coordinate,
        y: nearby[0].y_coordinate,
      });
      processed.add(nearby[0].id);
    } else {
      // Cluster
      const centerX = nearby.reduce((sum, n) => sum + n.x_coordinate, 0) / nearby.length;
      const centerY = nearby.reduce((sum, n) => sum + n.y_coordinate, 0) / nearby.length;
      
      clusters.push({
        type: 'cluster',
        nodes: nearby,
        x: centerX,
        y: centerY,
        count: nearby.length,
      });

      nearby.forEach(n => processed.add(n.id));
    }
  }

  return clusters;
}

/**
 * Determine appropriate LOD level based on zoom
 */
export function getLODLevel(scale: number): 'high' | 'medium' | 'low' {
  if (scale > 0.8) return 'high';
  if (scale > 0.3) return 'medium';
  return 'low';
}

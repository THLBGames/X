/**
 * Canvas utility functions for floor designer
 */

export interface Point {
  x: number;
  y: number;
}

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

/**
 * Apply transform to a point
 */
export function applyTransform(point: Point, transform: Transform): Point {
  return {
    x: (point.x - transform.x) * transform.scale,
    y: (point.y - transform.y) * transform.scale,
  };
}

/**
 * Apply inverse transform (screen to world coordinates)
 */
export function applyInverseTransform(point: Point, transform: Transform): Point {
  return {
    x: point.x / transform.scale + transform.x,
    y: point.y / transform.scale + transform.y,
  };
}

/**
 * Calculate distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get chunk coordinates for a point
 */
export function getChunkCoords(point: Point, chunkSize: number): { x: number; y: number } {
  return {
    x: Math.floor(point.x / chunkSize),
    y: Math.floor(point.y / chunkSize),
  };
}

/**
 * Get chunk key for coordinates
 */
export function getChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}

/**
 * Get visible chunks in viewport
 */
export function getVisibleChunks(
  viewport: { x: number; y: number; width: number; height: number },
  chunkSize: number,
  transform: Transform
): Set<string> {
  const chunks = new Set<string>();

  // Convert viewport corners to world coordinates
  const topLeft = applyInverseTransform({ x: 0, y: 0 }, transform);
  const bottomRight = applyInverseTransform(
    { x: viewport.width, y: viewport.height },
    transform
  );

  const startChunk = getChunkCoords(topLeft, chunkSize);
  const endChunk = getChunkCoords(bottomRight, chunkSize);

  // Add padding for prefetching
  const padding = 1;
  for (let x = startChunk.x - padding; x <= endChunk.x + padding; x++) {
    for (let y = startChunk.y - padding; y <= endChunk.y + padding; y++) {
      chunks.add(getChunkKey(x, y));
    }
  }

  return chunks;
}

/**
 * Check if a point is within a bounding box
 */
export function pointInBounds(point: Point, bounds: { x: number; y: number; width: number; height: number }): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

/**
 * Snap point to grid
 */
export function snapToGrid(point: Point, gridSize: number): Point {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

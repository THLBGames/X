import { FloorNodeModel, type FloorNode } from '../models/FloorNode.js';
import { FloorConnectionModel } from '../models/FloorConnection.js';
import { ParticipantPositionModel } from '../models/ParticipantPosition.js';
import { pool } from '../config/database.js';
import { GameRulesService } from './GameRulesService.js';

interface BossRoomLock {
  nodeId: string;
  isLocked: boolean;
  lockedAt: Date | null;
  lockedReason: 'capacity' | 'engaged' | null;
  playersInside: string[]; // Participant IDs
}

export class BossRoomService {
  private static lockCache: Map<string, BossRoomLock> = new Map();

  /**
   * Check if a boss room is locked
   */
  static async isBossRoomLocked(nodeId: string, floorId: string): Promise<boolean> {
    const cacheKey = `${floorId}:${nodeId}`;
    
    // Check cache
    if (this.lockCache.has(cacheKey)) {
      const lock = this.lockCache.get(cacheKey)!;
      return lock.isLocked;
    }

    // Check database for lock status
    const node = await FloorNodeModel.findById(nodeId);
    if (!node || node.node_type !== 'boss') {
      return false;
    }

    // Check if room should be locked based on capacity
    if (node.capacity_limit !== null) {
      const playersOnNode = await ParticipantPositionModel.getPlayersOnNode(nodeId);
      if (playersOnNode.length >= node.capacity_limit) {
        const lock: BossRoomLock = {
          nodeId,
          isLocked: true,
          lockedAt: new Date(),
          lockedReason: 'capacity',
          playersInside: playersOnNode,
        };
        this.lockCache.set(cacheKey, lock);
        return true;
      }
    }

    // Check metadata for explicit lock status
    if (node.metadata?.isLocked === true) {
      const lock: BossRoomLock = {
        nodeId,
        isLocked: true,
        lockedAt: node.metadata.lockedAt ? new Date(node.metadata.lockedAt) : new Date(),
        lockedReason: node.metadata.lockedReason || null,
        playersInside: await ParticipantPositionModel.getPlayersOnNode(nodeId),
      };
      this.lockCache.set(cacheKey, lock);
      return true;
    }

    return false;
  }

  /**
   * Lock a boss room (when boss is engaged or capacity reached)
   */
  static async lockBossRoom(
    nodeId: string,
    floorId: string,
    reason: 'capacity' | 'engaged'
  ): Promise<void> {
    const node = await FloorNodeModel.findById(nodeId);
    if (!node || node.node_type !== 'boss') {
      throw new Error('Node is not a boss room');
    }

    const playersOnNode = await ParticipantPositionModel.getPlayersOnNode(nodeId);
    const lock: BossRoomLock = {
      nodeId,
      isLocked: true,
      lockedAt: new Date(),
      lockedReason: reason,
      playersInside: playersOnNode,
    };

    // Update node metadata
    const updatedMetadata = {
      ...node.metadata,
      isLocked: true,
      lockedAt: new Date().toISOString(),
      lockedReason: reason,
    };

    await FloorNodeModel.update(nodeId, { metadata: updatedMetadata });

    // Update cache
    const cacheKey = `${floorId}:${nodeId}`;
    this.lockCache.set(cacheKey, lock);

    // Disable incoming connections (prevent new entries)
    // Note: This is a simplified approach - in a full implementation,
    // you might want to track which connections are disabled
  }

  /**
   * Unlock a boss room (when boss is defeated)
   */
  static async unlockBossRoom(nodeId: string, floorId: string): Promise<void> {
    const node = await FloorNodeModel.findById(nodeId);
    if (!node) {
      return;
    }

    // Update node metadata
    const updatedMetadata = {
      ...node.metadata,
      isLocked: false,
      lockedAt: null,
      lockedReason: null,
    };

    await FloorNodeModel.update(nodeId, { metadata: updatedMetadata });

    // Update cache
    const cacheKey = `${floorId}:${nodeId}`;
    if (this.lockCache.has(cacheKey)) {
      const lock = this.lockCache.get(cacheKey)!;
      lock.isLocked = false;
      lock.lockedAt = null;
      lock.lockedReason = null;
    }
  }

  /**
   * Check if a player can enter a boss room
   */
  static async canEnterBossRoom(
    nodeId: string,
    floorId: string,
    participantId: string,
    labyrinthId?: string
  ): Promise<{ canEnter: boolean; reason?: string }> {
    const node = await FloorNodeModel.findById(nodeId);
    if (!node || node.node_type !== 'boss') {
      return { canEnter: true };
    }

    // Check if room is locked
    const isLocked = await this.isBossRoomLocked(nodeId, floorId);
    if (isLocked) {
      // Get rules to check if locked rooms prevent entry
      const rules = labyrinthId
        ? await GameRulesService.getRulesForLabyrinth(labyrinthId)
        : GameRulesService.getGlobalRules();

      if (rules.bossRoom.lockOnEngage || rules.bossRoom.lockOnCapacity) {
        return { canEnter: false, reason: 'Boss room is locked' };
      }
    }

    // Check capacity
    if (node.capacity_limit !== null) {
      const playersOnNode = await ParticipantPositionModel.getPlayersOnNode(nodeId);
      if (playersOnNode.length >= node.capacity_limit) {
        return { canEnter: false, reason: 'Boss room is at capacity' };
      }
    }

    return { canEnter: true };
  }

  /**
   * Check if a player can exit a boss room
   */
  static async canExitBossRoom(
    nodeId: string,
    floorId: string,
    participantId: string,
    labyrinthId?: string
  ): Promise<{ canExit: boolean; reason?: string }> {
    const node = await FloorNodeModel.findById(nodeId);
    if (!node || node.node_type !== 'boss') {
      return { canExit: true };
    }

    // Check if room is locked
    const isLocked = await this.isBossRoomLocked(nodeId, floorId);
    if (isLocked) {
      // Get rules to check if locked rooms prevent exit
      const rules = labyrinthId
        ? await GameRulesService.getRulesForLabyrinth(labyrinthId)
        : GameRulesService.getGlobalRules();

      if (rules.bossRoom.preventExitWhenLocked) {
        // Check if player is inside the locked room
        const playersOnNode = await ParticipantPositionModel.getPlayersOnNode(nodeId);
        if (playersOnNode.includes(participantId)) {
          return { canExit: false, reason: 'Boss room is locked - cannot exit until boss is defeated' };
        }
      }
    }

    return { canExit: true };
  }

  /**
   * Get lock status for a boss room
   */
  static async getBossRoomLockStatus(
    nodeId: string,
    floorId: string
  ): Promise<BossRoomLock | null> {
    const cacheKey = `${floorId}:${nodeId}`;
    
    if (this.lockCache.has(cacheKey)) {
      return this.lockCache.get(cacheKey)!;
    }

    const isLocked = await this.isBossRoomLocked(nodeId, floorId);
    if (!isLocked) {
      return null;
    }

    const node = await FloorNodeModel.findById(nodeId);
    if (!node) {
      return null;
    }

    const playersOnNode = await ParticipantPositionModel.getPlayersOnNode(nodeId);
    const lock: BossRoomLock = {
      nodeId,
      isLocked: true,
      lockedAt: node.metadata?.lockedAt ? new Date(node.metadata.lockedAt) : new Date(),
      lockedReason: node.metadata?.lockedReason || null,
      playersInside: playersOnNode,
    };

    this.lockCache.set(cacheKey, lock);
    return lock;
  }

  /**
   * Clear lock cache for a node (useful when floor resets)
   */
  static clearCache(floorId?: string): void {
    if (floorId) {
      // Clear all locks for this floor
      const keysToDelete: string[] = [];
      this.lockCache.forEach((_, key) => {
        if (key.startsWith(`${floorId}:`)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach((key) => this.lockCache.delete(key));
    } else {
      this.lockCache.clear();
    }
  }
}
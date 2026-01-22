import { Server } from 'socket.io';
import { LabyrinthParticipantModel } from '../models/LabyrinthParticipant.js';

// In-memory storage for player positions and state
interface PlayerPosition {
  participant_id: string;
  character_id: string;
  floor_number: number;
  position: { x: number; y: number };
  last_update: number;
}

class PlayerSyncService {
  private playerPositions: Map<string, PlayerPosition> = new Map();
  private participantToSocket: Map<string, string> = new Map(); // participant_id -> socket_id
  private socketToParticipant: Map<string, string> = new Map(); // socket_id -> participant_id

  /**
   * Register a player's socket connection
   */
  registerPlayer(socket_id: string, participant_id: string, character_id: string, floor_number: number): void {
    this.socketToParticipant.set(socket_id, participant_id);
    this.participantToSocket.set(participant_id, socket_id);
    this.playerPositions.set(participant_id, {
      participant_id,
      character_id,
      floor_number,
      position: { x: 0, y: 0 },
      last_update: Date.now(),
    });
  }

  /**
   * Unregister a player's socket connection
   */
  unregisterPlayer(socket_id: string): void {
    const participant_id = this.socketToParticipant.get(socket_id);
    if (participant_id) {
      this.socketToParticipant.delete(socket_id);
      this.participantToSocket.delete(participant_id);
      this.playerPositions.delete(participant_id);
    }
  }

  /**
   * Update player position
   */
  updatePosition(participant_id: string, position: { x: number; y: number }): void {
    const player = this.playerPositions.get(participant_id);
    if (player) {
      player.position = position;
      player.last_update = Date.now();
    }
  }

  /**
   * Get all players on a specific floor
   */
  getFloorPlayers(labyrinth_id: string, floor_number: number): PlayerPosition[] {
    return Array.from(this.playerPositions.values()).filter(
      (p) => p.floor_number === floor_number
    );
  }

  /**
   * Find players within proximity of a position
   */
  findNearbyPlayers(
    participant_id: string,
    position: { x: number; y: number },
    range: number = 100
  ): PlayerPosition[] {
    const player = this.playerPositions.get(participant_id);
    if (!player) return [];

    return Array.from(this.playerPositions.values()).filter((p) => {
      if (p.participant_id === participant_id) return false;
      if (p.floor_number !== player.floor_number) return false;

      const distance = Math.sqrt(
        Math.pow(p.position.x - position.x, 2) + Math.pow(p.position.y - position.y, 2)
      );
      return distance <= range;
    });
  }

  /**
   * Broadcast player discovery to nearby players
   */
  async broadcastPlayerDiscovery(io: Server, participant_id: string, discoveredPlayer: PlayerPosition): Promise<void> {
    const participant = await LabyrinthParticipantModel.findById(participant_id);
    if (!participant) return;

    const socket_id = this.participantToSocket.get(participant_id);
    if (socket_id) {
      io.to(socket_id).emit('labyrinth:player_discovered', {
        character_id: discoveredPlayer.character_id,
        position: discoveredPlayer.position,
      });
    }
  }

  /**
   * Get socket ID for a participant
   */
  getSocketId(participant_id: string): string | undefined {
    return this.participantToSocket.get(participant_id);
  }

  /**
   * Get participant ID for a socket
   */
  getParticipantId(socket_id: string): string | undefined {
    return this.socketToParticipant.get(socket_id);
  }

  /**
   * Clean up stale positions (older than 5 minutes)
   */
  cleanupStalePositions(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [participant_id, player] of this.playerPositions.entries()) {
      if (now - player.last_update > staleThreshold) {
        this.playerPositions.delete(participant_id);
        const socket_id = this.participantToSocket.get(participant_id);
        if (socket_id) {
          this.socketToParticipant.delete(socket_id);
          this.participantToSocket.delete(participant_id);
        }
      }
    }
  }
}

// Singleton instance
export const playerSyncService = new PlayerSyncService();

// Cleanup stale positions every minute
setInterval(() => {
  playerSyncService.cleanupStalePositions();
}, 60 * 1000);

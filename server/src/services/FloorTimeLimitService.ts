import { pool } from '../config/database.js';
import { LabyrinthParticipantModel } from '../models/LabyrinthParticipant.js';
import { ParticipantPositionModel } from '../models/ParticipantPosition.js';
import { LabyrinthFloorModel } from '../models/LabyrinthFloor.js';
import { RewardService } from './RewardService.js';
import { Server } from 'socket.io';

export class FloorTimeLimitService {
  /**
   * Check and eliminate participants who have exceeded their floor time limit
   */
  static async checkAndEliminateExpired(io?: Server): Promise<void> {
    try {
      // Get all active participants with their positions
      const participants = await pool.query(
        `SELECT p.*, pos.floor_id, pos.floor_joined_at
         FROM labyrinth_participants p
         LEFT JOIN labyrinth_participant_positions pos ON p.id = pos.participant_id
         WHERE p.status = 'active'`
      );

      const now = Date.now();
      const eliminated: Array<{ participant_id: string; character_id: string }> = [];

      for (const row of participants.rows) {
        if (!row.floor_id || !row.floor_joined_at) continue;

        const floor = await LabyrinthFloorModel.findById(row.floor_id);
        if (!floor || !floor.time_limit_hours) continue;

        const floorJoinedAt = new Date(row.floor_joined_at).getTime();
        const timeLimitMs = floor.time_limit_hours * 60 * 60 * 1000;
        const timeElapsed = now - floorJoinedAt;

        if (timeElapsed >= timeLimitMs) {
          // Time limit exceeded - eliminate participant
          await LabyrinthParticipantModel.updateStatusWithElimination(
            row.id,
            'eliminated',
            {
              eliminated_at: new Date(),
              eliminated_by: 'time_limit',
            }
          );

          // Award participation reward
          await RewardService.awardRewards(
            row.labyrinth_id,
            {
              id: row.id,
              labyrinth_id: row.labyrinth_id,
              character_id: row.character_id,
              party_id: row.party_id,
              floor_number: row.floor_number,
              status: 'eliminated',
              eliminated_at: new Date(),
              eliminated_by: 'time_limit',
              final_stats: null,
              joined_at: row.joined_at,
              last_seen: row.last_seen,
            },
            {
              floor_reached: row.floor_number,
            }
          );

          eliminated.push({
            participant_id: row.id,
            character_id: row.character_id,
          });

          // Send Socket.IO notification if available
          if (io) {
            io.emit('labyrinth:eliminated', {
              participant_id: row.id,
              character_id: row.character_id,
              reason: 'time_limit',
              floor_number: row.floor_number,
            });
          }
        }
      }

      if (eliminated.length > 0) {
        console.log(`[FloorTimeLimitService] Eliminated ${eliminated.length} participants for exceeding time limits`);
      }
    } catch (error) {
      console.error('[FloorTimeLimitService] Error checking time limits:', error);
    }
  }

  /**
   * Get time remaining for a participant on their current floor
   */
  static async getTimeRemaining(participant_id: string): Promise<number | null> {
    try {
      const position = await ParticipantPositionModel.findByParticipantId(participant_id);
      if (!position) return null;

      const floor = await LabyrinthFloorModel.findById(position.floor_id);
      if (!floor || !floor.time_limit_hours) return null;

      const floorJoinedAt = position.floor_joined_at.getTime();
      const timeLimitMs = floor.time_limit_hours * 60 * 60 * 1000;
      const timeElapsed = Date.now() - floorJoinedAt;
      const timeRemaining = Math.max(0, timeLimitMs - timeElapsed);

      return timeRemaining;
    } catch (error) {
      console.error('[FloorTimeLimitService] Error getting time remaining:', error);
      return null;
    }
  }

  /**
   * Start periodic time limit checking (call this from server startup)
   */
  static startPeriodicCheck(io?: Server, intervalMinutes: number = 60): NodeJS.Timeout {
    // Run immediately
    this.checkAndEliminateExpired(io);

    // Then run periodically
    return setInterval(() => {
      this.checkAndEliminateExpired(io);
    }, intervalMinutes * 60 * 1000);
  }
}

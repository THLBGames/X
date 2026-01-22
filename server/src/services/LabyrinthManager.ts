import { LabyrinthModel, type Labyrinth, type CreateLabyrinthInput } from '../models/Labyrinth.js';
import { LabyrinthFloorModel, type LabyrinthFloor } from '../models/LabyrinthFloor.js';
import { LabyrinthParticipantModel, type LabyrinthParticipant } from '../models/LabyrinthParticipant.js';
import { LabyrinthPartyModel } from '../models/LabyrinthParty.js';
import { pool } from '../config/database.js';

export class LabyrinthManager {
  /**
   * Create a new labyrinth with floors
   */
  static async createLabyrinth(input: CreateLabyrinthInput, floors: Array<{
    floor_number: number;
    max_players: number;
    monster_pool?: any[];
    loot_table?: any[];
    environment_type?: string;
    rules?: Record<string, any>;
  }>): Promise<{ labyrinth: Labyrinth; floors: LabyrinthFloor[] }> {
    // Create labyrinth
    const labyrinth = await LabyrinthModel.create(input);

    // Create floors
    const createdFloors: LabyrinthFloor[] = [];
    for (const floorInput of floors) {
      const floor = await LabyrinthFloorModel.create({
        ...floorInput,
        labyrinth_id: labyrinth.id,
      });
      createdFloors.push(floor);
    }

    return { labyrinth, floors: createdFloors };
  }

  /**
   * Start a scheduled labyrinth
   */
  static async startLabyrinth(labyrinth_id: string): Promise<Labyrinth | null> {
    const labyrinth = await LabyrinthModel.findById(labyrinth_id);
    if (!labyrinth || labyrinth.status !== 'scheduled') {
      throw new Error('Labyrinth not found or not scheduled');
    }

    // Update status to active
    const updatedLabyrinth = await LabyrinthModel.updateStatus(labyrinth_id, 'active', {
      actual_start: new Date(),
    });

    // Assign start points to all participants who don't have positions on floor 1
    const floor1 = await LabyrinthFloorModel.findByLabyrinthAndFloor(labyrinth_id, 1);
    if (floor1) {
      const { MovementService } = await import('./MovementService.js');
      const { ParticipantPositionModel } = await import('../models/ParticipantPosition.js');
      
      // Get all active participants on floor 1
      const participants = await LabyrinthParticipantModel.findByLabyrinthAndFloor(labyrinth_id, 1);
      
      // Assign positions to participants who don't have them
      for (const participant of participants) {
        if (participant.status === 'active') {
          const existingPosition = await ParticipantPositionModel.findByParticipantAndFloor(
            participant.id,
            floor1.id
          );
          
          if (!existingPosition) {
            // Initialize position for this participant
            await MovementService.initializePosition(
              participant.id,
              floor1.id,
              null, // Deprecated parameter, ignored
              floor1.max_movement_points || 10,
              labyrinth_id
            );
          }
        }
      }
    }

    return updatedLabyrinth;
  }

  /**
   * Complete a labyrinth and set winner
   */
  static async completeLabyrinth(labyrinth_id: string, winner_character_id: string): Promise<Labyrinth | null> {
    return await LabyrinthModel.updateStatus(labyrinth_id, 'completed', {
      completed_at: new Date(),
      winner_character_id,
    });
  }

  /**
   * Join a labyrinth as a player
   */
  static async joinLabyrinth(labyrinth_id: string, character_id: string, party_id?: string | null): Promise<LabyrinthParticipant> {
    const labyrinth = await LabyrinthModel.findById(labyrinth_id);
    if (!labyrinth) {
      throw new Error('Labyrinth not found');
    }

    if (labyrinth.status !== 'active' && labyrinth.status !== 'scheduled') {
      throw new Error('Labyrinth is not accepting new players');
    }

    // Check if already participating
    const existing = await LabyrinthParticipantModel.findByLabyrinthAndCharacter(labyrinth_id, character_id);
    if (existing) {
      throw new Error('Character is already participating in this labyrinth');
    }

    // Check current capacity on floor 1
    const floor1Count = await LabyrinthParticipantModel.countByFloor(labyrinth_id, 1);
    const floor1 = await LabyrinthFloorModel.findByLabyrinthAndFloor(labyrinth_id, 1);
    if (floor1 && floor1Count >= floor1.max_players) {
      throw new Error('Floor 1 is at maximum capacity');
    }

    // Create participant
    const participant = await LabyrinthParticipantModel.create({
      labyrinth_id,
      character_id,
      party_id: party_id || null,
      floor_number: 1,
    });

    // Initialize participant position
    if (floor1) {
      const { MovementService } = await import('./MovementService.js');
      await MovementService.initializePosition(
        participant.id,
        floor1.id,
        null, // Deprecated parameter, ignored - MovementService uses equal distribution
        floor1.max_movement_points || 10,
        labyrinth_id // Pass labyrinth_id for rules
      );
    }

    return participant;
  }

  /**
   * Get active players on a floor
   */
  static async getFloorPlayers(labyrinth_id: string, floor_number: number): Promise<LabyrinthParticipant[]> {
    return await LabyrinthParticipantModel.findByLabyrinthAndFloor(labyrinth_id, floor_number);
  }

  /**
   * Check if a labyrinth has a winner
   */
  static async checkForWinner(labyrinth_id: string): Promise<string | null> {
    const participants = await pool.query(
      `SELECT character_id FROM labyrinth_participants 
       WHERE labyrinth_id = $1 AND status = 'active'`,
      [labyrinth_id]
    );

    if (participants.rows.length === 1) {
      return participants.rows[0].character_id;
    }

    return null;
  }
}

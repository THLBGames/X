import { LabyrinthFloorModel, type LabyrinthFloor } from '../models/LabyrinthFloor.js';
import { LabyrinthParticipantModel } from '../models/LabyrinthParticipant.js';
import { LabyrinthPartyModel } from '../models/LabyrinthParty.js';

export class FloorManager {
  /**
   * Attempt to advance a participant to the next floor
   */
  static async advanceFloor(
    labyrinth_id: string,
    participant_id: string,
    current_floor: number
  ): Promise<{ success: boolean; new_floor?: number; error?: string }> {
    // Get next floor
    const nextFloor = await LabyrinthFloorModel.findByLabyrinthAndFloor(labyrinth_id, current_floor + 1);
    if (!nextFloor) {
      return { success: false, error: 'No next floor available' };
    }

    // Check capacity
    const currentCount = await LabyrinthParticipantModel.countByFloor(labyrinth_id, nextFloor.floor_number);
    if (currentCount >= nextFloor.max_players) {
      return { success: false, error: 'Next floor is at maximum capacity' };
    }

    // Get participant
    const participant = await LabyrinthParticipantModel.findById(participant_id);
    if (!participant || participant.status !== 'active') {
      return { success: false, error: 'Participant not found or not active' };
    }

    // Update participant floor
    await LabyrinthParticipantModel.updateFloor(participant_id, nextFloor.floor_number);

    // If in a party, update party floor
    if (participant.party_id) {
      await LabyrinthPartyModel.updateFloor(participant.party_id, nextFloor.floor_number);
    }

    return { success: true, new_floor: nextFloor.floor_number };
  }

  /**
   * Mark a floor as completed
   */
  static async completeFloor(floor_id: string): Promise<void> {
    await LabyrinthFloorModel.markCompleted(floor_id);
  }

  /**
   * Get floor details
   */
  static async getFloor(labyrinth_id: string, floor_number: number): Promise<LabyrinthFloor | null> {
    return await LabyrinthFloorModel.findByLabyrinthAndFloor(labyrinth_id, floor_number);
  }

  /**
   * Check if floor has space for more players
   */
  static async hasFloorCapacity(labyrinth_id: string, floor_number: number): Promise<boolean> {
    const floor = await LabyrinthFloorModel.findByLabyrinthAndFloor(labyrinth_id, floor_number);
    if (!floor) return false;

    const currentCount = await LabyrinthParticipantModel.countByFloor(labyrinth_id, floor_number);
    return currentCount < floor.max_players;
  }
}

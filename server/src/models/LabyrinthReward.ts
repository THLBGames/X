import { pool } from '../config/database.js';

export type RewardType = 'title' | 'achievement' | 'skill' | 'loot_box' | 'item' | 'gold';

export interface LabyrinthReward {
  id: string;
  labyrinth_id: string;
  character_id: string;
  reward_type: RewardType;
  reward_id: string;
  quantity: number;
  earned_at: Date;
  claimed: boolean;
}

export interface CreateRewardInput {
  labyrinth_id: string;
  character_id: string;
  reward_type: RewardType;
  reward_id: string;
  quantity?: number;
}

export class LabyrinthRewardModel {
  static async create(input: CreateRewardInput): Promise<LabyrinthReward> {
    const result = await pool.query(
      `INSERT INTO labyrinth_rewards (labyrinth_id, character_id, reward_type, reward_id, quantity)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.labyrinth_id, input.character_id, input.reward_type, input.reward_id, input.quantity || 1]
    );
    return this.mapRowToReward(result.rows[0]);
  }

  static async findByCharacter(labyrinth_id: string, character_id: string): Promise<LabyrinthReward[]> {
    const result = await pool.query(
      'SELECT * FROM labyrinth_rewards WHERE labyrinth_id = $1 AND character_id = $2 ORDER BY earned_at DESC',
      [labyrinth_id, character_id]
    );
    return result.rows.map((row) => this.mapRowToReward(row));
  }

  static async findUnclaimedByCharacter(character_id: string): Promise<LabyrinthReward[]> {
    const result = await pool.query(
      'SELECT * FROM labyrinth_rewards WHERE character_id = $1 AND claimed = false ORDER BY earned_at DESC',
      [character_id]
    );
    return result.rows.map((row) => this.mapRowToReward(row));
  }

  static async markClaimed(id: string): Promise<void> {
    await pool.query('UPDATE labyrinth_rewards SET claimed = true WHERE id = $1', [id]);
  }

  private static mapRowToReward(row: any): LabyrinthReward {
    return {
      id: row.id,
      labyrinth_id: row.labyrinth_id,
      character_id: row.character_id,
      reward_type: row.reward_type,
      reward_id: row.reward_id,
      quantity: row.quantity,
      earned_at: row.earned_at,
      claimed: row.claimed,
    };
  }
}

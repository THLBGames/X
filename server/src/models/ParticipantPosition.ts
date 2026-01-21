import { pool } from '../config/database.js';

export interface ParticipantPosition {
  id: string;
  participant_id: string;
  floor_id: string;
  current_node_id: string | null;
  movement_points: number;
  max_movement_points: number;
  last_movement_time: Date;
  explored_nodes: string[];
  floor_joined_at: Date;
  movement_history: Array<{ node_id: string; timestamp: string; movement_cost: number }>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateParticipantPositionInput {
  participant_id: string;
  floor_id: string;
  current_node_id: string | null;
  movement_points?: number;
  max_movement_points?: number;
}

export class ParticipantPositionModel {
  static async create(input: CreateParticipantPositionInput): Promise<ParticipantPosition> {
    const result = await pool.query(
      `INSERT INTO labyrinth_participant_positions 
       (participant_id, floor_id, current_node_id, movement_points, max_movement_points)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.participant_id,
        input.floor_id,
        input.current_node_id,
        input.movement_points ?? input.max_movement_points ?? 10,
        input.max_movement_points ?? 10,
      ]
    );
    return this.mapRowToPosition(result.rows[0]);
  }

  static async findByParticipantId(participant_id: string): Promise<ParticipantPosition | null> {
    const result = await pool.query(
      'SELECT * FROM labyrinth_participant_positions WHERE participant_id = $1',
      [participant_id]
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToPosition(result.rows[0]);
  }

  static async findByParticipantAndFloor(
    participant_id: string,
    floor_id: string
  ): Promise<ParticipantPosition | null> {
    const result = await pool.query(
      'SELECT * FROM labyrinth_participant_positions WHERE participant_id = $1 AND floor_id = $2',
      [participant_id, floor_id]
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToPosition(result.rows[0]);
  }

  static async updatePosition(
    participant_id: string,
    floor_id: string,
    updates: {
      current_node_id?: string | null;
      movement_points?: number;
      explored_nodes?: string[];
      movement_history?: Array<{ node_id: string; timestamp: string; movement_cost: number }>;
    }
  ): Promise<ParticipantPosition | null> {
    const updatesList: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.current_node_id !== undefined) {
      updatesList.push(`current_node_id = $${paramCount++}`);
      values.push(updates.current_node_id);
    }
    if (updates.movement_points !== undefined) {
      updatesList.push(`movement_points = $${paramCount++}`);
      values.push(updates.movement_points);
    }
    if (updates.explored_nodes !== undefined) {
      updatesList.push(`explored_nodes = $${paramCount++}`);
      values.push(JSON.stringify(updates.explored_nodes));
    }
    if (updates.movement_history !== undefined) {
      updatesList.push(`movement_history = $${paramCount++}`);
      values.push(JSON.stringify(updates.movement_history));
    }

    if (updatesList.length === 0) {
      return this.findByParticipantAndFloor(participant_id, floor_id);
    }

    updatesList.push(`last_movement_time = CURRENT_TIMESTAMP`);
    updatesList.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(participant_id, floor_id);

    const result = await pool.query(
      `UPDATE labyrinth_participant_positions 
       SET ${updatesList.join(', ')} 
       WHERE participant_id = $${paramCount} AND floor_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToPosition(result.rows[0]);
  }

  static async updateMovementPoints(
    participant_id: string,
    floor_id: string,
    movement_points: number
  ): Promise<void> {
    await pool.query(
      `UPDATE labyrinth_participant_positions 
       SET movement_points = $1, last_movement_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE participant_id = $2 AND floor_id = $3`,
      [movement_points, participant_id, floor_id]
    );
  }

  static async getPlayersOnNode(node_id: string): Promise<string[]> {
    const result = await pool.query(
      `SELECT participant_id FROM labyrinth_participant_positions WHERE current_node_id = $1`,
      [node_id]
    );
    return result.rows.map((row) => row.participant_id);
  }

  private static mapRowToPosition(row: any): ParticipantPosition {
    return {
      id: row.id,
      participant_id: row.participant_id,
      floor_id: row.floor_id,
      current_node_id: row.current_node_id,
      movement_points: parseFloat(row.movement_points),
      max_movement_points: row.max_movement_points,
      last_movement_time: row.last_movement_time,
      explored_nodes: Array.isArray(row.explored_nodes) 
        ? row.explored_nodes 
        : (typeof row.explored_nodes === 'string' ? JSON.parse(row.explored_nodes) : []),
      floor_joined_at: row.floor_joined_at,
      movement_history: Array.isArray(row.movement_history)
        ? row.movement_history
        : (typeof row.movement_history === 'string' ? JSON.parse(row.movement_history) : []),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

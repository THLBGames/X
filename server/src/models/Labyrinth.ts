import { pool } from '../config/database.js';

export type LabyrinthStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export interface Labyrinth {
  id: string;
  name: string;
  status: LabyrinthStatus;
  scheduled_start: Date;
  actual_start: Date | null;
  completed_at: Date | null;
  total_floors: number;
  max_initial_players: number;
  rules_config: Record<string, any>;
  winner_character_id: string | null;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateLabyrinthInput {
  name: string;
  scheduled_start: Date;
  total_floors: number;
  max_initial_players: number;
  rules_config?: Record<string, any>;
  metadata?: Record<string, any>;
}

export class LabyrinthModel {
  static async create(input: CreateLabyrinthInput): Promise<Labyrinth> {
    const result = await pool.query(
      `INSERT INTO labyrinths (name, scheduled_start, total_floors, max_initial_players, rules_config, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.name,
        input.scheduled_start,
        input.total_floors,
        input.max_initial_players,
        JSON.stringify(input.rules_config || {}),
        JSON.stringify(input.metadata || {}),
      ]
    );
    return this.mapRowToLabyrinth(result.rows[0]);
  }

  static async findById(id: string): Promise<Labyrinth | null> {
    const result = await pool.query('SELECT * FROM labyrinths WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToLabyrinth(result.rows[0]);
  }

  static async findByStatus(status: LabyrinthStatus): Promise<Labyrinth[]> {
    const result = await pool.query('SELECT * FROM labyrinths WHERE status = $1 ORDER BY scheduled_start ASC', [status]);
    return result.rows.map((row) => this.mapRowToLabyrinth(row));
  }

  static async updateStatus(id: string, status: LabyrinthStatus, additionalData?: Partial<Labyrinth>): Promise<Labyrinth | null> {
    const updates: string[] = ['status = $2'];
    const values: any[] = [id, status];

    if (additionalData?.actual_start !== undefined) {
      updates.push(`actual_start = $${values.length + 1}`);
      values.push(additionalData.actual_start);
    }

    if (additionalData?.completed_at !== undefined) {
      updates.push(`completed_at = $${values.length + 1}`);
      values.push(additionalData.completed_at);
    }

    if (additionalData?.winner_character_id !== undefined) {
      updates.push(`winner_character_id = $${values.length + 1}`);
      values.push(additionalData.winner_character_id);
    }

    const result = await pool.query(
      `UPDATE labyrinths SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToLabyrinth(result.rows[0]);
  }

  static async listAvailable(): Promise<Labyrinth[]> {
    const result = await pool.query(
      `SELECT * FROM labyrinths 
       WHERE status IN ('scheduled', 'active') 
       ORDER BY scheduled_start ASC`
    );
    return result.rows.map((row) => this.mapRowToLabyrinth(row));
  }

  private static mapRowToLabyrinth(row: any): Labyrinth {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      scheduled_start: row.scheduled_start,
      actual_start: row.actual_start,
      completed_at: row.completed_at,
      total_floors: row.total_floors,
      max_initial_players: row.max_initial_players,
      rules_config: typeof row.rules_config === 'string' ? JSON.parse(row.rules_config) : row.rules_config,
      winner_character_id: row.winner_character_id,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

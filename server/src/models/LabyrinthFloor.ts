import { pool } from '../config/database.js';

export interface LabyrinthFloor {
  id: string;
  labyrinth_id: string;
  floor_number: number;
  max_players: number;
  monster_pool: any[];
  loot_table: any[];
  environment_type: string;
  rules: Record<string, any>;
  time_limit_hours: number | null;
  movement_regen_rate: number | null;
  max_movement_points: number | null;
  completed_at: Date | null;
  created_at: Date;
}

export interface CreateFloorInput {
  labyrinth_id: string;
  floor_number: number;
  max_players: number;
  monster_pool?: any[];
  loot_table?: any[];
  environment_type?: string;
  rules?: Record<string, any>;
}

export class LabyrinthFloorModel {
  static async create(input: CreateFloorInput): Promise<LabyrinthFloor> {
    const result = await pool.query(
      `INSERT INTO labyrinth_floors (labyrinth_id, floor_number, max_players, monster_pool, loot_table, environment_type, rules)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.labyrinth_id,
        input.floor_number,
        input.max_players,
        JSON.stringify(input.monster_pool || []),
        JSON.stringify(input.loot_table || []),
        input.environment_type || 'dungeon',
        JSON.stringify(input.rules || {}),
      ]
    );
    return this.mapRowToFloor(result.rows[0]);
  }

  static async findByLabyrinthId(labyrinth_id: string): Promise<LabyrinthFloor[]> {
    const result = await pool.query(
      'SELECT * FROM labyrinth_floors WHERE labyrinth_id = $1 ORDER BY floor_number ASC',
      [labyrinth_id]
    );
    return result.rows.map((row) => this.mapRowToFloor(row));
  }

  static async findById(id: string): Promise<LabyrinthFloor | null> {
    const result = await pool.query('SELECT * FROM labyrinth_floors WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToFloor(result.rows[0]);
  }

  static async findByLabyrinthAndFloor(labyrinth_id: string, floor_number: number): Promise<LabyrinthFloor | null> {
    const result = await pool.query(
      'SELECT * FROM labyrinth_floors WHERE labyrinth_id = $1 AND floor_number = $2',
      [labyrinth_id, floor_number]
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToFloor(result.rows[0]);
  }

  static async markCompleted(id: string): Promise<void> {
    await pool.query('UPDATE labyrinth_floors SET completed_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
  }

  private static mapRowToFloor(row: any): LabyrinthFloor {
    return {
      id: row.id,
      labyrinth_id: row.labyrinth_id,
      floor_number: row.floor_number,
      max_players: row.max_players,
      monster_pool: typeof row.monster_pool === 'string' ? JSON.parse(row.monster_pool) : row.monster_pool,
      loot_table: typeof row.loot_table === 'string' ? JSON.parse(row.loot_table) : row.loot_table,
      environment_type: row.environment_type,
      rules: typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules,
      time_limit_hours: row.time_limit_hours,
      movement_regen_rate: row.movement_regen_rate ? parseFloat(row.movement_regen_rate) : null,
      max_movement_points: row.max_movement_points,
      completed_at: row.completed_at,
      created_at: row.created_at,
    };
  }
}

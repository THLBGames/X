import { pool } from '../config/database.js';

export interface FloorConnection {
  id: string;
  floor_id: string;
  from_node_id: string;
  to_node_id: string;
  movement_cost: number;
  is_bidirectional: boolean;
  required_item: string | null;
  visibility_requirement: Record<string, any> | null;
  created_at: Date;
}

export interface CreateFloorConnectionInput {
  id?: string; // Optional: if provided, use this ID instead of generating a new one
  floor_id: string;
  from_node_id: string;
  to_node_id: string;
  movement_cost?: number;
  is_bidirectional?: boolean;
  required_item?: string | null;
  visibility_requirement?: Record<string, any> | null;
}

export class FloorConnectionModel {
  static async create(input: CreateFloorConnectionInput): Promise<FloorConnection> {
    // If ID is provided, use it; otherwise let the database generate one
    if (input.id) {
      const result = await pool.query(
        `INSERT INTO labyrinth_floor_connections 
         (id, floor_id, from_node_id, to_node_id, movement_cost, is_bidirectional, required_item, visibility_requirement)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           floor_id = EXCLUDED.floor_id,
           from_node_id = EXCLUDED.from_node_id,
           to_node_id = EXCLUDED.to_node_id,
           movement_cost = EXCLUDED.movement_cost,
           is_bidirectional = EXCLUDED.is_bidirectional,
           required_item = EXCLUDED.required_item,
           visibility_requirement = EXCLUDED.visibility_requirement
         RETURNING *`,
        [
          input.id,
          input.floor_id,
          input.from_node_id,
          input.to_node_id,
          input.movement_cost ?? 1,
          input.is_bidirectional ?? true,
          input.required_item || null,
          input.visibility_requirement ? JSON.stringify(input.visibility_requirement) : null,
        ]
      );
      return this.mapRowToConnection(result.rows[0]);
    } else {
      const result = await pool.query(
        `INSERT INTO labyrinth_floor_connections 
         (floor_id, from_node_id, to_node_id, movement_cost, is_bidirectional, required_item, visibility_requirement)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          input.floor_id,
          input.from_node_id,
          input.to_node_id,
          input.movement_cost ?? 1,
          input.is_bidirectional ?? true,
          input.required_item || null,
          input.visibility_requirement ? JSON.stringify(input.visibility_requirement) : null,
        ]
      );
      return this.mapRowToConnection(result.rows[0]);
    }
  }

  static async findById(id: string): Promise<FloorConnection | null> {
    const result = await pool.query('SELECT * FROM labyrinth_floor_connections WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToConnection(result.rows[0]);
  }

  static async findByFloorId(floor_id: string): Promise<FloorConnection[]> {
    const result = await pool.query(
      'SELECT * FROM labyrinth_floor_connections WHERE floor_id = $1',
      [floor_id]
    );
    return result.rows.map((row) => this.mapRowToConnection(row));
  }

  static async findByNodeId(node_id: string): Promise<FloorConnection[]> {
    const result = await pool.query(
      `SELECT * FROM labyrinth_floor_connections 
       WHERE from_node_id = $1 OR to_node_id = $1`,
      [node_id]
    );
    return result.rows.map((row) => this.mapRowToConnection(row));
  }

  static async findByNodes(node_a_id: string, node_b_id: string): Promise<FloorConnection | null> {
    const result = await pool.query(
      `SELECT * FROM labyrinth_floor_connections
       WHERE (from_node_id = $1 AND to_node_id = $2)
          OR (from_node_id = $2 AND to_node_id = $1 AND is_bidirectional = true)
       LIMIT 1`,
      [node_a_id, node_b_id]
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToConnection(result.rows[0]);
  }

  static async getAdjacentNodes(node_id: string): Promise<string[]> {
    const result = await pool.query(
      `SELECT DISTINCT 
         CASE WHEN from_node_id = $1 THEN to_node_id ELSE from_node_id END as adjacent_id
       FROM labyrinth_floor_connections
       WHERE from_node_id = $1 OR (to_node_id = $1 AND is_bidirectional = true)`,
      [node_id]
    );
    return result.rows.map((row) => row.adjacent_id);
  }

  static async canMoveBetween(from_node_id: string, to_node_id: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM labyrinth_floor_connections
       WHERE (from_node_id = $1 AND to_node_id = $2)
          OR (from_node_id = $2 AND to_node_id = $1 AND is_bidirectional = true)
       LIMIT 1`,
      [from_node_id, to_node_id]
    );
    return result.rows.length > 0;
  }

  static async update(id: string, updates: Partial<CreateFloorConnectionInput>): Promise<FloorConnection | null> {
    const updatesList: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.floor_id !== undefined) {
      updatesList.push(`floor_id = $${paramCount++}`);
      values.push(updates.floor_id);
    }
    if (updates.from_node_id !== undefined) {
      updatesList.push(`from_node_id = $${paramCount++}`);
      values.push(updates.from_node_id);
    }
    if (updates.to_node_id !== undefined) {
      updatesList.push(`to_node_id = $${paramCount++}`);
      values.push(updates.to_node_id);
    }
    if (updates.movement_cost !== undefined) {
      updatesList.push(`movement_cost = $${paramCount++}`);
      values.push(updates.movement_cost);
    }
    if (updates.is_bidirectional !== undefined) {
      updatesList.push(`is_bidirectional = $${paramCount++}`);
      values.push(updates.is_bidirectional);
    }
    if (updates.required_item !== undefined) {
      updatesList.push(`required_item = $${paramCount++}`);
      values.push(updates.required_item);
    }
    if (updates.visibility_requirement !== undefined) {
      updatesList.push(`visibility_requirement = $${paramCount++}`);
      values.push(updates.visibility_requirement ? JSON.stringify(updates.visibility_requirement) : null);
    }

    if (updatesList.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE labyrinth_floor_connections SET ${updatesList.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToConnection(result.rows[0]);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM labyrinth_floor_connections WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async deleteByFloorId(floor_id: string): Promise<void> {
    await pool.query('DELETE FROM labyrinth_floor_connections WHERE floor_id = $1', [floor_id]);
  }

  private static mapRowToConnection(row: any): FloorConnection {
    return {
      id: row.id,
      floor_id: row.floor_id,
      from_node_id: row.from_node_id,
      to_node_id: row.to_node_id,
      movement_cost: row.movement_cost,
      is_bidirectional: row.is_bidirectional,
      required_item: row.required_item,
      visibility_requirement: row.visibility_requirement 
        ? (typeof row.visibility_requirement === 'string' 
          ? JSON.parse(row.visibility_requirement) 
          : row.visibility_requirement)
        : null,
      created_at: row.created_at,
    };
  }
}

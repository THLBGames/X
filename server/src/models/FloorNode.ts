import { pool } from '../config/database.js';

export type NodeType = 'boss' | 'monster_spawn' | 'monster_spawner' | 'safe_zone' | 'crafting' | 'stairs' | 'regular' | 'guild_hall';

export interface FloorNode {
  id: string;
  floor_id: string;
  node_type: NodeType;
  x_coordinate: number;
  y_coordinate: number;
  name: string | null;
  description: string | null;
  metadata: Record<string, any>;
  required_boss_defeated: string | null;
  is_revealed: boolean;
  is_start_point: boolean;
  leads_to_floor_number: number | null;
  capacity_limit: number | null;
  created_at: Date;
}

export interface CreateFloorNodeInput {
  id?: string; // Optional: if provided, use this ID instead of generating a new one
  floor_id: string;
  node_type: NodeType;
  x_coordinate: number;
  y_coordinate: number;
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
  required_boss_defeated?: string | null;
  is_revealed?: boolean;
  is_start_point?: boolean;
  leads_to_floor_number?: number | null;
  capacity_limit?: number | null;
}

export class FloorNodeModel {
  static async create(input: CreateFloorNodeInput): Promise<FloorNode> {
    // If ID is provided, use it; otherwise let the database generate one
    if (input.id) {
      const result = await pool.query(
        `INSERT INTO labyrinth_floor_nodes 
         (id, floor_id, node_type, x_coordinate, y_coordinate, name, description, metadata, 
          required_boss_defeated, is_revealed, is_start_point, leads_to_floor_number, capacity_limit)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           floor_id = EXCLUDED.floor_id,
           node_type = EXCLUDED.node_type,
           x_coordinate = EXCLUDED.x_coordinate,
           y_coordinate = EXCLUDED.y_coordinate,
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           metadata = EXCLUDED.metadata,
           required_boss_defeated = EXCLUDED.required_boss_defeated,
           is_revealed = EXCLUDED.is_revealed,
           is_start_point = EXCLUDED.is_start_point,
           leads_to_floor_number = EXCLUDED.leads_to_floor_number,
           capacity_limit = EXCLUDED.capacity_limit
         RETURNING *`,
        [
          input.id,
          input.floor_id,
          input.node_type,
          input.x_coordinate,
          input.y_coordinate,
          input.name || null,
          input.description || null,
          JSON.stringify(input.metadata || {}),
          input.required_boss_defeated || null,
          input.is_revealed ?? false,
          input.is_start_point ?? false,
          input.leads_to_floor_number || null,
          input.capacity_limit || null,
        ]
      );
      return this.mapRowToNode(result.rows[0]);
    } else {
      const result = await pool.query(
        `INSERT INTO labyrinth_floor_nodes 
         (floor_id, node_type, x_coordinate, y_coordinate, name, description, metadata, 
          required_boss_defeated, is_revealed, is_start_point, leads_to_floor_number, capacity_limit)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          input.floor_id,
          input.node_type,
          input.x_coordinate,
          input.y_coordinate,
          input.name || null,
          input.description || null,
          JSON.stringify(input.metadata || {}),
          input.required_boss_defeated || null,
          input.is_revealed ?? false,
          input.is_start_point ?? false,
          input.leads_to_floor_number || null,
          input.capacity_limit || null,
        ]
      );
      return this.mapRowToNode(result.rows[0]);
    }
  }

  static async findById(id: string): Promise<FloorNode | null> {
    const result = await pool.query('SELECT * FROM labyrinth_floor_nodes WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToNode(result.rows[0]);
  }

  static async findByFloorId(floor_id: string): Promise<FloorNode[]> {
    const result = await pool.query(
      'SELECT * FROM labyrinth_floor_nodes WHERE floor_id = $1 ORDER BY created_at',
      [floor_id]
    );
    return result.rows.map((row) => this.mapRowToNode(row));
  }

  static async findByFloorAndType(floor_id: string, node_type: NodeType): Promise<FloorNode[]> {
    const result = await pool.query(
      'SELECT * FROM labyrinth_floor_nodes WHERE floor_id = $1 AND node_type = $2',
      [floor_id, node_type]
    );
    return result.rows.map((row) => this.mapRowToNode(row));
  }

  static async update(id: string, updates: Partial<CreateFloorNodeInput>): Promise<FloorNode | null> {
    const updatesList: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.node_type !== undefined) {
      updatesList.push(`node_type = $${paramCount++}`);
      values.push(updates.node_type);
    }
    if (updates.x_coordinate !== undefined) {
      updatesList.push(`x_coordinate = $${paramCount++}`);
      values.push(updates.x_coordinate);
    }
    if (updates.y_coordinate !== undefined) {
      updatesList.push(`y_coordinate = $${paramCount++}`);
      values.push(updates.y_coordinate);
    }
    if (updates.name !== undefined) {
      updatesList.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      updatesList.push(`description = $${paramCount++}`);
      values.push(updates.description);
    }
    if (updates.metadata !== undefined) {
      updatesList.push(`metadata = $${paramCount++}`);
      values.push(JSON.stringify(updates.metadata));
    }
    if (updates.required_boss_defeated !== undefined) {
      updatesList.push(`required_boss_defeated = $${paramCount++}`);
      values.push(updates.required_boss_defeated);
    }
    if (updates.is_revealed !== undefined) {
      updatesList.push(`is_revealed = $${paramCount++}`);
      values.push(updates.is_revealed);
    }
    if (updates.is_start_point !== undefined) {
      updatesList.push(`is_start_point = $${paramCount++}`);
      values.push(updates.is_start_point);
    }
    if (updates.leads_to_floor_number !== undefined) {
      updatesList.push(`leads_to_floor_number = $${paramCount++}`);
      values.push(updates.leads_to_floor_number);
    }
    if (updates.capacity_limit !== undefined) {
      updatesList.push(`capacity_limit = $${paramCount++}`);
      values.push(updates.capacity_limit);
    }

    if (updatesList.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE labyrinth_floor_nodes SET ${updatesList.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToNode(result.rows[0]);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM labyrinth_floor_nodes WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async deleteByFloorId(floor_id: string): Promise<void> {
    await pool.query('DELETE FROM labyrinth_floor_nodes WHERE floor_id = $1', [floor_id]);
  }

  static async findStartNodesByFloorId(floor_id: string): Promise<FloorNode[]> {
    const result = await pool.query(
      'SELECT * FROM labyrinth_floor_nodes WHERE floor_id = $1 AND is_start_point = true ORDER BY created_at',
      [floor_id]
    );
    return result.rows.map((row) => this.mapRowToNode(row));
  }

  private static mapRowToNode(row: any): FloorNode {
    return {
      id: row.id,
      floor_id: row.floor_id,
      node_type: row.node_type,
      x_coordinate: parseFloat(row.x_coordinate),
      y_coordinate: parseFloat(row.y_coordinate),
      name: row.name,
      description: row.description,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      required_boss_defeated: row.required_boss_defeated,
      is_revealed: row.is_revealed,
      is_start_point: row.is_start_point ?? false,
      leads_to_floor_number: row.leads_to_floor_number,
      capacity_limit: row.capacity_limit,
      created_at: row.created_at,
    };
  }
}

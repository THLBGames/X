import { pool } from '../config/database.js';

export interface Achievement {
  id: string;
  name: string;
  description: string | null;
  category: string;
  requirements: Record<string, any>;
  rewards: Record<string, any>;
  hidden: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAchievementInput {
  id: string;
  name: string;
  description?: string;
  category: string;
  requirements: Record<string, any>;
  rewards: Record<string, any>;
  hidden?: boolean;
}

export interface UpdateAchievementInput {
  name?: string;
  description?: string;
  category?: string;
  requirements?: Record<string, any>;
  rewards?: Record<string, any>;
  hidden?: boolean;
}

export class AchievementModel {
  /**
   * Create a new achievement
   */
  static async create(input: CreateAchievementInput): Promise<Achievement> {
    const result = await pool.query(
      `INSERT INTO achievements (id, name, description, category, requirements, rewards, hidden)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.id,
        input.name,
        input.description || null,
        input.category,
        JSON.stringify(input.requirements),
        JSON.stringify(input.rewards),
        input.hidden ?? false,
      ]
    );

    return this.mapRowToAchievement(result.rows[0]);
  }

  /**
   * Find achievement by ID
   */
  static async findById(id: string): Promise<Achievement | null> {
    const result = await pool.query('SELECT * FROM achievements WHERE id = $1', [id]);

    if (result.rows.length === 0) return null;
    return this.mapRowToAchievement(result.rows[0]);
  }

  /**
   * List all achievements
   */
  static async listAll(): Promise<Achievement[]> {
    const result = await pool.query('SELECT * FROM achievements ORDER BY category, name');
    return result.rows.map((row) => this.mapRowToAchievement(row));
  }

  /**
   * List achievements by category
   */
  static async listByCategory(category: string): Promise<Achievement[]> {
    const result = await pool.query(
      'SELECT * FROM achievements WHERE category = $1 ORDER BY name',
      [category]
    );
    return result.rows.map((row) => this.mapRowToAchievement(row));
  }

  /**
   * Update achievement
   */
  static async update(id: string, updates: UpdateAchievementInput): Promise<Achievement | null> {
    const updatesList: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
      updatesList.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      updatesList.push(`description = $${paramCount++}`);
      values.push(updates.description);
    }

    if (updates.category !== undefined) {
      updatesList.push(`category = $${paramCount++}`);
      values.push(updates.category);
    }

    if (updates.requirements !== undefined) {
      updatesList.push(`requirements = $${paramCount++}`);
      values.push(JSON.stringify(updates.requirements));
    }

    if (updates.rewards !== undefined) {
      updatesList.push(`rewards = $${paramCount++}`);
      values.push(JSON.stringify(updates.rewards));
    }

    if (updates.hidden !== undefined) {
      updatesList.push(`hidden = $${paramCount++}`);
      values.push(updates.hidden);
    }

    if (updatesList.length === 0) {
      return this.findById(id);
    }

    updatesList.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE achievements SET ${updatesList.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToAchievement(result.rows[0]);
  }

  /**
   * Delete achievement
   */
  static async delete(id: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM achievements WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  private static mapRowToAchievement(row: any): Achievement {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      requirements:
        typeof row.requirements === 'string' ? JSON.parse(row.requirements) : row.requirements,
      rewards: typeof row.rewards === 'string' ? JSON.parse(row.rewards) : row.rewards,
      hidden: row.hidden,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

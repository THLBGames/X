import { pool } from '../config/database.js';

export interface Monster {
  id: string;
  name: string;
  description: string | null;
  name_key: string | null;
  description_key: string | null;
  tier: number;
  level: number;
  stats: {
    health: number;
    maxHealth: number;
    mana: number;
    maxMana: number;
    attack: number;
    defense: number;
    magicAttack: number;
    magicDefense: number;
    speed: number;
    criticalChance: number;
    criticalDamage: number;
  };
  abilities?: Array<{
    id: string;
    name: string;
    type: 'attack' | 'heal' | 'buff' | 'debuff';
    chance: number;
    effect: Record<string, any>;
  }>;
  loot_table: Array<{
    itemId: string;
    chance: number;
    min?: number;
    max?: number;
    quantity?: number;
  }>;
  experience_reward: number;
  gold_reward: {
    min: number;
    max: number;
  } | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMonsterInput {
  id: string;
  name: string;
  description?: string;
  name_key?: string;
  description_key?: string;
  tier: number;
  level: number;
  stats: Monster['stats'];
  abilities?: Monster['abilities'];
  loot_table?: Monster['loot_table'];
  experience_reward: number;
  gold_reward?: Monster['gold_reward'];
}

export interface UpdateMonsterInput {
  name?: string;
  description?: string;
  name_key?: string;
  description_key?: string;
  tier?: number;
  level?: number;
  stats?: Monster['stats'];
  abilities?: Monster['abilities'];
  loot_table?: Monster['loot_table'];
  experience_reward?: number;
  gold_reward?: Monster['gold_reward'];
}

export class MonsterModel {
  /**
   * Create a new monster
   */
  static async create(input: CreateMonsterInput): Promise<Monster> {
    const result = await pool.query(
      `INSERT INTO monsters (
        id, name, description, name_key, description_key, tier, level,
        stats, abilities, loot_table, experience_reward, gold_reward
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        input.id,
        input.name,
        input.description || null,
        input.name_key || null,
        input.description_key || null,
        input.tier,
        input.level,
        JSON.stringify(input.stats),
        JSON.stringify(input.abilities || []),
        JSON.stringify(input.loot_table || []),
        input.experience_reward,
        input.gold_reward ? JSON.stringify(input.gold_reward) : null,
      ]
    );

    return this.mapRowToMonster(result.rows[0]);
  }

  /**
   * Find monster by ID
   */
  static async findById(id: string): Promise<Monster | null> {
    const result = await pool.query('SELECT * FROM monsters WHERE id = $1', [id]);

    if (result.rows.length === 0) return null;
    return this.mapRowToMonster(result.rows[0]);
  }

  /**
   * List all monsters
   */
  static async listAll(): Promise<Monster[]> {
    const result = await pool.query('SELECT * FROM monsters ORDER BY tier, level, name');
    return result.rows.map((row) => this.mapRowToMonster(row));
  }

  /**
   * List monsters by tier
   */
  static async listByTier(tier: number): Promise<Monster[]> {
    const result = await pool.query('SELECT * FROM monsters WHERE tier = $1 ORDER BY level, name', [
      tier,
    ]);
    return result.rows.map((row) => this.mapRowToMonster(row));
  }

  /**
   * Update monster
   */
  static async update(id: string, updates: UpdateMonsterInput): Promise<Monster | null> {
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

    if (updates.name_key !== undefined) {
      updatesList.push(`name_key = $${paramCount++}`);
      values.push(updates.name_key);
    }

    if (updates.description_key !== undefined) {
      updatesList.push(`description_key = $${paramCount++}`);
      values.push(updates.description_key);
    }

    if (updates.tier !== undefined) {
      updatesList.push(`tier = $${paramCount++}`);
      values.push(updates.tier);
    }

    if (updates.level !== undefined) {
      updatesList.push(`level = $${paramCount++}`);
      values.push(updates.level);
    }

    if (updates.stats !== undefined) {
      updatesList.push(`stats = $${paramCount++}`);
      values.push(JSON.stringify(updates.stats));
    }

    if (updates.abilities !== undefined) {
      updatesList.push(`abilities = $${paramCount++}`);
      values.push(JSON.stringify(updates.abilities));
    }

    if (updates.loot_table !== undefined) {
      updatesList.push(`loot_table = $${paramCount++}`);
      values.push(JSON.stringify(updates.loot_table));
    }

    if (updates.experience_reward !== undefined) {
      updatesList.push(`experience_reward = $${paramCount++}`);
      values.push(updates.experience_reward);
    }

    if (updates.gold_reward !== undefined) {
      updatesList.push(`gold_reward = $${paramCount++}`);
      values.push(updates.gold_reward ? JSON.stringify(updates.gold_reward) : null);
    }

    if (updatesList.length === 0) {
      return this.findById(id);
    }

    updatesList.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE monsters SET ${updatesList.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToMonster(result.rows[0]);
  }

  /**
   * Delete monster
   */
  static async delete(id: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM monsters WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Bulk create monsters (for migration)
   */
  static async bulkCreate(monsters: CreateMonsterInput[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const monster of monsters) {
        await client.query(
          `INSERT INTO monsters (
            id, name, description, name_key, description_key, tier, level,
            stats, abilities, loot_table, experience_reward, gold_reward
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            name_key = EXCLUDED.name_key,
            description_key = EXCLUDED.description_key,
            tier = EXCLUDED.tier,
            level = EXCLUDED.level,
            stats = EXCLUDED.stats,
            abilities = EXCLUDED.abilities,
            loot_table = EXCLUDED.loot_table,
            experience_reward = EXCLUDED.experience_reward,
            gold_reward = EXCLUDED.gold_reward,
            updated_at = CURRENT_TIMESTAMP`,
          [
            monster.id,
            monster.name,
            monster.description || null,
            monster.name_key || null,
            monster.description_key || null,
            monster.tier,
            monster.level,
            JSON.stringify(monster.stats),
            JSON.stringify(monster.abilities || []),
            JSON.stringify(monster.loot_table || []),
            monster.experience_reward,
            monster.gold_reward ? JSON.stringify(monster.gold_reward) : null,
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private static mapRowToMonster(row: any): Monster {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      name_key: row.name_key,
      description_key: row.description_key,
      tier: row.tier,
      level: row.level,
      stats:
        typeof row.stats === 'string' ? JSON.parse(row.stats) : row.stats,
      abilities:
        typeof row.abilities === 'string' ? JSON.parse(row.abilities) : row.abilities || [],
      loot_table:
        typeof row.loot_table === 'string' ? JSON.parse(row.loot_table) : row.loot_table || [],
      experience_reward: row.experience_reward,
      gold_reward:
        row.gold_reward && typeof row.gold_reward === 'string'
          ? JSON.parse(row.gold_reward)
          : row.gold_reward,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

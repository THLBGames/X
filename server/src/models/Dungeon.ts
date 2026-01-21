import { pool } from '../config/database.js';

export interface Dungeon {
  id: string;
  name: string;
  description: string | null;
  name_key: string | null;
  description_key: string | null;
  tier: number;
  required_level: number | null;
  required_dungeon_id: string | null;
  monster_pools: Array<{
    monsterId: string;
    weight: number;
    minLevel?: number;
    maxLevel?: number;
  }>;
  rewards: {
    experienceBonus?: number;
    goldBonus?: number;
    itemDropRate?: number;
  };
  unlock_conditions: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDungeonInput {
  id: string;
  name: string;
  description?: string;
  nameKey?: string;
  descriptionKey?: string;
  tier: number;
  requiredLevel?: number;
  requiredDungeonId?: string;
  monsterPools?: Array<{
    monsterId: string;
    weight: number;
    minLevel?: number;
    maxLevel?: number;
  }>;
  rewards?: {
    experienceBonus?: number;
    goldBonus?: number;
    itemDropRate?: number;
  };
  unlockConditions?: Record<string, any>;
}

export class DungeonModel {
  static async create(input: CreateDungeonInput): Promise<Dungeon> {
    const result = await pool.query(
      `INSERT INTO dungeons (
        id, name, description, name_key, description_key, tier,
        required_level, required_dungeon_id, monster_pools, rewards, unlock_conditions
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        input.id,
        input.name,
        input.description || null,
        input.nameKey || null,
        input.descriptionKey || null,
        input.tier,
        input.requiredLevel || null,
        input.requiredDungeonId || null,
        JSON.stringify(input.monsterPools || []),
        JSON.stringify(input.rewards || {}),
        JSON.stringify(input.unlockConditions || {}),
      ]
    );

    return this.mapRowToDungeon(result.rows[0]);
  }

  static async findById(id: string): Promise<Dungeon | null> {
    const result = await pool.query('SELECT * FROM dungeons WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToDungeon(result.rows[0]);
  }

  static async listAll(): Promise<Dungeon[]> {
    const result = await pool.query('SELECT * FROM dungeons ORDER BY tier, required_level, name');
    return result.rows.map((row) => this.mapRowToDungeon(row));
  }

  static async bulkCreate(dungeons: CreateDungeonInput[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const dungeon of dungeons) {
        await client.query(
          `INSERT INTO dungeons (
            id, name, description, name_key, description_key, tier,
            required_level, required_dungeon_id, monster_pools, rewards, unlock_conditions
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            name_key = EXCLUDED.name_key,
            description_key = EXCLUDED.description_key,
            tier = EXCLUDED.tier,
            required_level = EXCLUDED.required_level,
            required_dungeon_id = EXCLUDED.required_dungeon_id,
            monster_pools = EXCLUDED.monster_pools,
            rewards = EXCLUDED.rewards,
            unlock_conditions = EXCLUDED.unlock_conditions,
            updated_at = CURRENT_TIMESTAMP`,
          [
            dungeon.id,
            dungeon.name,
            dungeon.description || null,
            dungeon.nameKey || null,
            dungeon.descriptionKey || null,
            dungeon.tier,
            dungeon.requiredLevel || null,
            dungeon.requiredDungeonId || null,
            JSON.stringify(dungeon.monsterPools || []),
            JSON.stringify(dungeon.rewards || {}),
            JSON.stringify(dungeon.unlockConditions || {}),
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

  private static mapRowToDungeon(row: any): Dungeon {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      name_key: row.name_key,
      description_key: row.description_key,
      tier: row.tier,
      required_level: row.required_level,
      required_dungeon_id: row.required_dungeon_id,
      monster_pools:
        typeof row.monster_pools === 'string'
          ? JSON.parse(row.monster_pools)
          : row.monster_pools || [],
      rewards:
        typeof row.rewards === 'string' ? JSON.parse(row.rewards) : row.rewards || {},
      unlock_conditions:
        typeof row.unlock_conditions === 'string'
          ? JSON.parse(row.unlock_conditions)
          : row.unlock_conditions || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

import { pool } from '../config/database.js';

export interface Quest {
  id: string;
  name: string;
  description: string | null;
  name_key: string | null;
  description_key: string | null;
  type: string | null;
  category: string | null;
  required_level: number | null;
  required_class: string | null;
  prerequisites: string[];
  objectives: Array<Record<string, any>>;
  rewards: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateQuestInput {
  id: string;
  name: string;
  description?: string;
  nameKey?: string;
  descriptionKey?: string;
  type?: string;
  category?: string;
  requiredLevel?: number;
  requiredClass?: string;
  prerequisites?: string[];
  objectives?: Array<Record<string, any>>;
  rewards?: Record<string, any>;
}

export class QuestModel {
  static async create(input: CreateQuestInput): Promise<Quest> {
    const result = await pool.query(
      `INSERT INTO quests (
        id, name, description, name_key, description_key, type, category,
        required_level, required_class, prerequisites, objectives, rewards
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        input.id,
        input.name,
        input.description || null,
        input.nameKey || null,
        input.descriptionKey || null,
        input.type || null,
        input.category || null,
        input.requiredLevel || null,
        input.requiredClass || null,
        JSON.stringify(input.prerequisites || []),
        JSON.stringify(input.objectives || []),
        JSON.stringify(input.rewards || {}),
      ]
    );

    return this.mapRowToQuest(result.rows[0]);
  }

  static async findById(id: string): Promise<Quest | null> {
    const result = await pool.query('SELECT * FROM quests WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToQuest(result.rows[0]);
  }

  static async listAll(): Promise<Quest[]> {
    const result = await pool.query('SELECT * FROM quests ORDER BY category, type, name');
    return result.rows.map((row) => this.mapRowToQuest(row));
  }

  static async bulkCreate(quests: CreateQuestInput[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const quest of quests) {
        await client.query(
          `INSERT INTO quests (
            id, name, description, name_key, description_key, type, category,
            required_level, required_class, prerequisites, objectives, rewards
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            name_key = EXCLUDED.name_key,
            description_key = EXCLUDED.description_key,
            type = EXCLUDED.type,
            category = EXCLUDED.category,
            required_level = EXCLUDED.required_level,
            required_class = EXCLUDED.required_class,
            prerequisites = EXCLUDED.prerequisites,
            objectives = EXCLUDED.objectives,
            rewards = EXCLUDED.rewards,
            updated_at = CURRENT_TIMESTAMP`,
          [
            quest.id,
            quest.name,
            quest.description || null,
            quest.nameKey || null,
            quest.descriptionKey || null,
            quest.type || null,
            quest.category || null,
            quest.requiredLevel || null,
            quest.requiredClass || null,
            JSON.stringify(quest.prerequisites || []),
            JSON.stringify(quest.objectives || []),
            JSON.stringify(quest.rewards || {}),
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

  private static mapRowToQuest(row: any): Quest {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      name_key: row.name_key,
      description_key: row.description_key,
      type: row.type,
      category: row.category,
      required_level: row.required_level,
      required_class: row.required_class,
      prerequisites:
        typeof row.prerequisites === 'string' ? JSON.parse(row.prerequisites) : row.prerequisites || [],
      objectives:
        typeof row.objectives === 'string' ? JSON.parse(row.objectives) : row.objectives || [],
      rewards: typeof row.rewards === 'string' ? JSON.parse(row.rewards) : row.rewards || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

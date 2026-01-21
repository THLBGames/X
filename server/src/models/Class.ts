import { pool } from '../config/database.js';

export interface Class {
  id: string;
  name: string;
  description: string | null;
  name_key: string | null;
  description_key: string | null;
  parent_class: string | null;
  unlock_level: number | null;
  is_subclass: boolean;
  required_quest_id: string | null;
  base_stats: Record<string, number>;
  stat_growth: Record<string, number>;
  available_skills: string[];
  equipment_restrictions: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateClassInput {
  id: string;
  name: string;
  description?: string;
  nameKey?: string;
  descriptionKey?: string;
  parentClass?: string;
  unlockLevel?: number;
  isSubclass?: boolean;
  requiredQuestId?: string;
  baseStats: Record<string, number>;
  statGrowth: Record<string, number>;
  availableSkills?: string[];
  equipmentRestrictions?: Record<string, any>;
}

export class ClassModel {
  static async create(input: CreateClassInput): Promise<Class> {
    const result = await pool.query(
      `INSERT INTO classes (
        id, name, description, name_key, description_key, parent_class,
        unlock_level, is_subclass, required_quest_id, base_stats,
        stat_growth, available_skills, equipment_restrictions
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        input.id,
        input.name,
        input.description || null,
        input.nameKey || null,
        input.descriptionKey || null,
        input.parentClass || null,
        input.unlockLevel || null,
        input.isSubclass ?? false,
        input.requiredQuestId || null,
        JSON.stringify(input.baseStats),
        JSON.stringify(input.statGrowth),
        JSON.stringify(input.availableSkills || []),
        JSON.stringify(input.equipmentRestrictions || {}),
      ]
    );

    return this.mapRowToClass(result.rows[0]);
  }

  static async findById(id: string): Promise<Class | null> {
    const result = await pool.query('SELECT * FROM classes WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToClass(result.rows[0]);
  }

  static async listAll(): Promise<Class[]> {
    const result = await pool.query('SELECT * FROM classes ORDER BY is_subclass, name');
    return result.rows.map((row) => this.mapRowToClass(row));
  }

  static async bulkCreate(classes: CreateClassInput[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const cls of classes) {
        await client.query(
          `INSERT INTO classes (
            id, name, description, name_key, description_key, parent_class,
            unlock_level, is_subclass, required_quest_id, base_stats,
            stat_growth, available_skills, equipment_restrictions
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            name_key = EXCLUDED.name_key,
            description_key = EXCLUDED.description_key,
            parent_class = EXCLUDED.parent_class,
            unlock_level = EXCLUDED.unlock_level,
            is_subclass = EXCLUDED.is_subclass,
            required_quest_id = EXCLUDED.required_quest_id,
            base_stats = EXCLUDED.base_stats,
            stat_growth = EXCLUDED.stat_growth,
            available_skills = EXCLUDED.available_skills,
            equipment_restrictions = EXCLUDED.equipment_restrictions,
            updated_at = CURRENT_TIMESTAMP`,
          [
            cls.id,
            cls.name,
            cls.description || null,
            cls.nameKey || null,
            cls.descriptionKey || null,
            cls.parentClass || null,
            cls.unlockLevel || null,
            cls.isSubclass ?? false,
            cls.requiredQuestId || null,
            JSON.stringify(cls.baseStats),
            JSON.stringify(cls.statGrowth),
            JSON.stringify(cls.availableSkills || []),
            JSON.stringify(cls.equipmentRestrictions || {}),
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

  private static mapRowToClass(row: any): Class {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      name_key: row.name_key,
      description_key: row.description_key,
      parent_class: row.parent_class,
      unlock_level: row.unlock_level,
      is_subclass: row.is_subclass,
      required_quest_id: row.required_quest_id,
      base_stats:
        typeof row.base_stats === 'string' ? JSON.parse(row.base_stats) : row.base_stats,
      stat_growth:
        typeof row.stat_growth === 'string' ? JSON.parse(row.stat_growth) : row.stat_growth,
      available_skills:
        typeof row.available_skills === 'string'
          ? JSON.parse(row.available_skills)
          : row.available_skills || [],
      equipment_restrictions:
        typeof row.equipment_restrictions === 'string'
          ? JSON.parse(row.equipment_restrictions)
          : row.equipment_restrictions || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

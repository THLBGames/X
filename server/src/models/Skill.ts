import { pool } from '../config/database.js';

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  name_key: string | null;
  description_key: string | null;
  type: string;
  category: string | null;
  max_level: number;
  experience_formula: string | null;
  prerequisites: string[];
  requirements: Record<string, any>;
  mana_cost: number | null;
  cooldown: number | null;
  target: string | null;
  effect: Record<string, any>;
  passive_bonus: Record<string, any> | null;
  resource_nodes: Record<string, any>[] | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSkillInput {
  id: string;
  name: string;
  description?: string;
  nameKey?: string;
  descriptionKey?: string;
  type: string;
  category?: string;
  maxLevel: number;
  experienceFormula?: string;
  prerequisites?: string[];
  requirements?: Record<string, any>;
  manaCost?: number;
  cooldown?: number;
  target?: string;
  effect?: Record<string, any>;
  passiveBonus?: Record<string, any>;
  resourceNodes?: Record<string, any>[];
}

export class SkillModel {
  static async create(input: CreateSkillInput): Promise<Skill> {
    const result = await pool.query(
      `INSERT INTO skills (
        id, name, description, name_key, description_key, type, category,
        max_level, experience_formula, prerequisites, requirements,
        mana_cost, cooldown, target, effect, passive_bonus, resource_nodes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        input.id,
        input.name,
        input.description || null,
        input.nameKey || null,
        input.descriptionKey || null,
        input.type,
        input.category || null,
        input.maxLevel,
        input.experienceFormula || null,
        JSON.stringify(input.prerequisites || []),
        JSON.stringify(input.requirements || {}),
        input.manaCost || null,
        input.cooldown || null,
        input.target || null,
        JSON.stringify(input.effect || {}),
        input.passiveBonus ? JSON.stringify(input.passiveBonus) : null,
        input.resourceNodes ? JSON.stringify(input.resourceNodes) : null,
      ]
    );

    return this.mapRowToSkill(result.rows[0]);
  }

  static async findById(id: string): Promise<Skill | null> {
    const result = await pool.query('SELECT * FROM skills WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToSkill(result.rows[0]);
  }

  static async listAll(): Promise<Skill[]> {
    const result = await pool.query('SELECT * FROM skills ORDER BY category, type, name');
    return result.rows.map((row) => this.mapRowToSkill(row));
  }

  static async bulkCreate(skills: CreateSkillInput[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const skill of skills) {
        await client.query(
          `INSERT INTO skills (
            id, name, description, name_key, description_key, type, category,
            max_level, experience_formula, prerequisites, requirements,
            mana_cost, cooldown, target, effect, passive_bonus, resource_nodes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            name_key = EXCLUDED.name_key,
            description_key = EXCLUDED.description_key,
            type = EXCLUDED.type,
            category = EXCLUDED.category,
            max_level = EXCLUDED.max_level,
            experience_formula = EXCLUDED.experience_formula,
            prerequisites = EXCLUDED.prerequisites,
            requirements = EXCLUDED.requirements,
            mana_cost = EXCLUDED.mana_cost,
            cooldown = EXCLUDED.cooldown,
            target = EXCLUDED.target,
            effect = EXCLUDED.effect,
            passive_bonus = EXCLUDED.passive_bonus,
            resource_nodes = EXCLUDED.resource_nodes,
            updated_at = CURRENT_TIMESTAMP`,
          [
            skill.id,
            skill.name,
            skill.description || null,
            skill.nameKey || null,
            skill.descriptionKey || null,
            skill.type,
            skill.category || null,
            skill.maxLevel,
            skill.experienceFormula || null,
            JSON.stringify(skill.prerequisites || []),
            JSON.stringify(skill.requirements || {}),
            skill.manaCost || null,
            skill.cooldown || null,
            skill.target || null,
            JSON.stringify(skill.effect || {}),
            skill.passiveBonus ? JSON.stringify(skill.passiveBonus) : null,
            skill.resourceNodes ? JSON.stringify(skill.resourceNodes) : null,
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

  private static mapRowToSkill(row: any): Skill {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      name_key: row.name_key,
      description_key: row.description_key,
      type: row.type,
      category: row.category,
      max_level: row.max_level,
      experience_formula: row.experience_formula,
      prerequisites:
        typeof row.prerequisites === 'string'
          ? JSON.parse(row.prerequisites)
          : row.prerequisites || [],
      requirements:
        typeof row.requirements === 'string' ? JSON.parse(row.requirements) : row.requirements || {},
      mana_cost: row.mana_cost,
      cooldown: row.cooldown,
      target: row.target,
      effect: typeof row.effect === 'string' ? JSON.parse(row.effect) : row.effect || {},
      passive_bonus:
        row.passive_bonus && typeof row.passive_bonus === 'string'
          ? JSON.parse(row.passive_bonus)
          : row.passive_bonus,
      resource_nodes:
        row.resource_nodes && typeof row.resource_nodes === 'string'
          ? JSON.parse(row.resource_nodes)
          : row.resource_nodes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

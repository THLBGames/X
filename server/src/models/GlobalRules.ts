import { pool } from '../config/database.js';

export interface GlobalRules {
  id: string;
  rules: {
    max_party_size?: number;
    pvp_enabled?: boolean;
    permadeath?: boolean;
    floor_progression?: {
      elimination_rules?: string;
    };
    combat?: {
      turn_based?: boolean;
      turn_timeout_seconds?: number;
    };
    rewards?: {
      participation_reward?: boolean;
      floor_based_rewards?: boolean;
      ranking_rewards?: boolean;
    };
  };
  updated_at: Date;
}

export class GlobalRulesModel {
  /**
   * Get global rules (always returns the default row)
   */
  static async get(): Promise<GlobalRules | null> {
    const result = await pool.query("SELECT * FROM global_rules WHERE id = 'default'");

    if (result.rows.length === 0) return null;
    return this.mapRowToGlobalRules(result.rows[0]);
  }

  /**
   * Update global rules
   */
  static async update(rules: GlobalRules['rules']): Promise<GlobalRules | null> {
    const result = await pool.query(
      `UPDATE global_rules 
       SET rules = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = 'default' 
       RETURNING *`,
      [JSON.stringify(rules)]
    );

    if (result.rows.length === 0) {
      // If no row exists, create it
      const insertResult = await pool.query(
        `INSERT INTO global_rules (id, rules) 
         VALUES ('default', $1) 
         RETURNING *`,
        [JSON.stringify(rules)]
      );
      return this.mapRowToGlobalRules(insertResult.rows[0]);
    }

    return this.mapRowToGlobalRules(result.rows[0]);
  }

  private static mapRowToGlobalRules(row: any): GlobalRules {
    return {
      id: row.id,
      rules: typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules,
      updated_at: row.updated_at,
    };
  }
}

import { pool } from '../config/database.js';

export interface Item {
  id: string;
  name: string;
  description: string | null;
  name_key: string | null;
  description_key: string | null;
  type: string;
  rarity: string;
  stackable: boolean;
  max_stack: number | null;
  value: number;
  requirements: Record<string, any>;
  equipment_slot: string | null;
  stat_bonuses: Record<string, any>;
  combat_stat_bonuses: Record<string, any>;
  consumable_effect: Record<string, any> | null;
  max_enchantments: number | null;
  enchantment_slots: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateItemInput {
  id: string;
  name: string;
  description?: string;
  nameKey?: string;
  descriptionKey?: string;
  type: string;
  rarity: string;
  stackable?: boolean;
  maxStack?: number;
  value?: number;
  requirements?: Record<string, any>;
  equipmentSlot?: string;
  statBonuses?: Record<string, any>;
  combatStatBonuses?: Record<string, any>;
  consumableEffect?: Record<string, any>;
  maxEnchantments?: number;
  enchantmentSlots?: number;
}

export interface UpdateItemInput {
  name?: string;
  description?: string;
  nameKey?: string;
  descriptionKey?: string;
  type?: string;
  rarity?: string;
  stackable?: boolean;
  maxStack?: number;
  value?: number;
  requirements?: Record<string, any>;
  equipmentSlot?: string;
  statBonuses?: Record<string, any>;
  combatStatBonuses?: Record<string, any>;
  consumableEffect?: Record<string, any>;
  maxEnchantments?: number;
  enchantmentSlots?: number;
}

export class ItemModel {
  static async create(input: CreateItemInput): Promise<Item> {
    const result = await pool.query(
      `INSERT INTO items (
        id, name, description, name_key, description_key, type, rarity,
        stackable, max_stack, value, requirements, equipment_slot,
        stat_bonuses, combat_stat_bonuses, consumable_effect,
        max_enchantments, enchantment_slots
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
        input.rarity,
        input.stackable ?? true,
        input.maxStack || null,
        input.value || 0,
        JSON.stringify(input.requirements || {}),
        input.equipmentSlot || null,
        JSON.stringify(input.statBonuses || {}),
        JSON.stringify(input.combatStatBonuses || {}),
        input.consumableEffect ? JSON.stringify(input.consumableEffect) : null,
        input.maxEnchantments || null,
        input.enchantmentSlots || null,
      ]
    );

    return this.mapRowToItem(result.rows[0]);
  }

  static async findById(id: string): Promise<Item | null> {
    const result = await pool.query('SELECT * FROM items WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToItem(result.rows[0]);
  }

  static async listAll(): Promise<Item[]> {
    const result = await pool.query('SELECT * FROM items ORDER BY type, rarity, name');
    return result.rows.map((row) => this.mapRowToItem(row));
  }

  static async listByType(type: string): Promise<Item[]> {
    const result = await pool.query('SELECT * FROM items WHERE type = $1 ORDER BY rarity, name', [
      type,
    ]);
    return result.rows.map((row) => this.mapRowToItem(row));
  }

  static async listByRarity(rarity: string): Promise<Item[]> {
    const result = await pool.query('SELECT * FROM items WHERE rarity = $1 ORDER BY type, name', [
      rarity,
    ]);
    return result.rows.map((row) => this.mapRowToItem(row));
  }

  static async update(id: string, updates: UpdateItemInput): Promise<Item | null> {
    const updatesList: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    const fields: Array<[keyof UpdateItemInput, string]> = [
      ['name', 'name'],
      ['description', 'description'],
      ['nameKey', 'name_key'],
      ['descriptionKey', 'description_key'],
      ['type', 'type'],
      ['rarity', 'rarity'],
      ['stackable', 'stackable'],
      ['maxStack', 'max_stack'],
      ['value', 'value'],
      ['equipmentSlot', 'equipment_slot'],
      ['maxEnchantments', 'max_enchantments'],
      ['enchantmentSlots', 'enchantment_slots'],
    ];

    for (const [inputKey, dbKey] of fields) {
      if (updates[inputKey] !== undefined) {
        updatesList.push(`${dbKey} = $${paramCount++}`);
        values.push(updates[inputKey]);
      }
    }

    if (updates.requirements !== undefined) {
      updatesList.push(`requirements = $${paramCount++}`);
      values.push(JSON.stringify(updates.requirements));
    }

    if (updates.statBonuses !== undefined) {
      updatesList.push(`stat_bonuses = $${paramCount++}`);
      values.push(JSON.stringify(updates.statBonuses));
    }

    if (updates.combatStatBonuses !== undefined) {
      updatesList.push(`combat_stat_bonuses = $${paramCount++}`);
      values.push(JSON.stringify(updates.combatStatBonuses));
    }

    if (updates.consumableEffect !== undefined) {
      updatesList.push(`consumable_effect = $${paramCount++}`);
      values.push(updates.consumableEffect ? JSON.stringify(updates.consumableEffect) : null);
    }

    if (updatesList.length === 0) {
      return this.findById(id);
    }

    updatesList.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE items SET ${updatesList.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToItem(result.rows[0]);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM items WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async bulkCreate(items: CreateItemInput[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const item of items) {
        await client.query(
          `INSERT INTO items (
            id, name, description, name_key, description_key, type, rarity,
            stackable, max_stack, value, requirements, equipment_slot,
            stat_bonuses, combat_stat_bonuses, consumable_effect,
            max_enchantments, enchantment_slots
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            name_key = EXCLUDED.name_key,
            description_key = EXCLUDED.description_key,
            type = EXCLUDED.type,
            rarity = EXCLUDED.rarity,
            stackable = EXCLUDED.stackable,
            max_stack = EXCLUDED.max_stack,
            value = EXCLUDED.value,
            requirements = EXCLUDED.requirements,
            equipment_slot = EXCLUDED.equipment_slot,
            stat_bonuses = EXCLUDED.stat_bonuses,
            combat_stat_bonuses = EXCLUDED.combat_stat_bonuses,
            consumable_effect = EXCLUDED.consumable_effect,
            max_enchantments = EXCLUDED.max_enchantments,
            enchantment_slots = EXCLUDED.enchantment_slots,
            updated_at = CURRENT_TIMESTAMP`,
          [
            item.id,
            item.name,
            item.description || null,
            item.nameKey || null,
            item.descriptionKey || null,
            item.type,
            item.rarity,
            item.stackable ?? true,
            item.maxStack || null,
            item.value || 0,
            JSON.stringify(item.requirements || {}),
            item.equipmentSlot || null,
            JSON.stringify(item.statBonuses || {}),
            JSON.stringify(item.combatStatBonuses || {}),
            item.consumableEffect ? JSON.stringify(item.consumableEffect) : null,
            item.maxEnchantments || null,
            item.enchantmentSlots || null,
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

  private static mapRowToItem(row: any): Item {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      name_key: row.name_key,
      description_key: row.description_key,
      type: row.type,
      rarity: row.rarity,
      stackable: row.stackable,
      max_stack: row.max_stack,
      value: row.value,
      requirements:
        typeof row.requirements === 'string' ? JSON.parse(row.requirements) : row.requirements || {},
      equipment_slot: row.equipment_slot,
      stat_bonuses:
        typeof row.stat_bonuses === 'string'
          ? JSON.parse(row.stat_bonuses)
          : row.stat_bonuses || {},
      combat_stat_bonuses:
        typeof row.combat_stat_bonuses === 'string'
          ? JSON.parse(row.combat_stat_bonuses)
          : row.combat_stat_bonuses || {},
      consumable_effect:
        row.consumable_effect && typeof row.consumable_effect === 'string'
          ? JSON.parse(row.consumable_effect)
          : row.consumable_effect,
      max_enchantments: row.max_enchantments,
      enchantment_slots: row.enchantment_slots,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

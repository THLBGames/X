import { pool } from '../config/database.js';
import bcrypt from 'bcrypt';

export interface AdminUser {
  id: string;
  username: string;
  password_hash: string;
  email: string | null;
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
  is_active: boolean;
}

export interface CreateAdminUserInput {
  username: string;
  password: string;
  email?: string;
}

export class AdminUserModel {
  /**
   * Create a new admin user
   */
  static async create(input: CreateAdminUserInput): Promise<AdminUser> {
    const password_hash = await bcrypt.hash(input.password, 10);
    
    const result = await pool.query(
      `INSERT INTO admin_users (username, password_hash, email)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.username, password_hash, input.email || null]
    );
    
    return this.mapRowToAdminUser(result.rows[0]);
  }

  /**
   * Find admin user by username
   */
  static async findByUsername(username: string): Promise<AdminUser | null> {
    const result = await pool.query(
      'SELECT * FROM admin_users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) return null;
    return this.mapRowToAdminUser(result.rows[0]);
  }

  /**
   * Find admin user by ID
   */
  static async findById(id: string): Promise<AdminUser | null> {
    const result = await pool.query(
      'SELECT * FROM admin_users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) return null;
    return this.mapRowToAdminUser(result.rows[0]);
  }

  /**
   * Verify password for an admin user
   */
  static async verifyPassword(user: AdminUser, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password_hash);
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(id: string): Promise<void> {
    await pool.query(
      'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  }

  /**
   * List all admin users
   */
  static async listAll(): Promise<AdminUser[]> {
    const result = await pool.query(
      'SELECT * FROM admin_users ORDER BY created_at DESC'
    );
    return result.rows.map((row) => this.mapRowToAdminUser(row));
  }

  /**
   * Update admin user
   */
  static async update(id: string, updates: { email?: string; is_active?: boolean; password?: string }): Promise<AdminUser | null> {
    const updatesList: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.email !== undefined) {
      updatesList.push(`email = $${paramCount++}`);
      values.push(updates.email);
    }

    if (updates.is_active !== undefined) {
      updatesList.push(`is_active = $${paramCount++}`);
      values.push(updates.is_active);
    }

    if (updates.password !== undefined) {
      const password_hash = await bcrypt.hash(updates.password, 10);
      updatesList.push(`password_hash = $${paramCount++}`);
      values.push(password_hash);
    }

    if (updatesList.length === 0) {
      return this.findById(id);
    }

    updatesList.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE admin_users SET ${updatesList.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToAdminUser(result.rows[0]);
  }

  /**
   * Delete admin user
   */
  static async delete(id: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM admin_users WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  private static mapRowToAdminUser(row: any): AdminUser {
    return {
      id: row.id,
      username: row.username,
      password_hash: row.password_hash,
      email: row.email,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_login: row.last_login,
      is_active: row.is_active,
    };
  }
}

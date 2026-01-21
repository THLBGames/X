import { pool } from '../config/database.js';

export type ParticipantStatus = 'active' | 'eliminated' | 'winner';

export interface LabyrinthParticipant {
  id: string;
  labyrinth_id: string;
  character_id: string;
  party_id: string | null;
  floor_number: number;
  status: ParticipantStatus;
  eliminated_at: Date | null;
  eliminated_by: string | null;
  final_stats: Record<string, any> | null;
  joined_at: Date;
  last_seen: Date;
}

export interface CreateParticipantInput {
  labyrinth_id: string;
  character_id: string;
  party_id?: string | null;
  floor_number?: number;
}

export class LabyrinthParticipantModel {
  static async create(input: CreateParticipantInput): Promise<LabyrinthParticipant> {
    const result = await pool.query(
      `INSERT INTO labyrinth_participants (labyrinth_id, character_id, party_id, floor_number)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.labyrinth_id, input.character_id, input.party_id || null, input.floor_number || 1]
    );
    return this.mapRowToParticipant(result.rows[0]);
  }

  static async findById(id: string): Promise<LabyrinthParticipant | null> {
    const result = await pool.query('SELECT * FROM labyrinth_participants WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToParticipant(result.rows[0]);
  }

  static async findByLabyrinthAndCharacter(labyrinth_id: string, character_id: string): Promise<LabyrinthParticipant | null> {
    const result = await pool.query(
      'SELECT * FROM labyrinth_participants WHERE labyrinth_id = $1 AND character_id = $2',
      [labyrinth_id, character_id]
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToParticipant(result.rows[0]);
  }

  static async findByLabyrinthAndFloor(labyrinth_id: string, floor_number: number): Promise<LabyrinthParticipant[]> {
    const result = await pool.query(
      'SELECT * FROM labyrinth_participants WHERE labyrinth_id = $1 AND floor_number = $2 AND status = $3',
      [labyrinth_id, floor_number, 'active']
    );
    return result.rows.map((row) => this.mapRowToParticipant(row));
  }

  static async updateFloor(id: string, floor_number: number): Promise<void> {
    await pool.query('UPDATE labyrinth_participants SET floor_number = $1, last_seen = CURRENT_TIMESTAMP WHERE id = $2', [
      floor_number,
      id,
    ]);
  }

  static async updateStatus(
    id: string,
    status: ParticipantStatus,
    eliminated_by?: string | null,
    final_stats?: Record<string, any>
  ): Promise<void> {
    await pool.query(
      `UPDATE labyrinth_participants 
       SET status = $1, eliminated_at = CASE WHEN $1 = 'eliminated' THEN CURRENT_TIMESTAMP ELSE eliminated_at END,
           eliminated_by = $2, final_stats = $3, last_seen = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [status, eliminated_by || null, final_stats ? JSON.stringify(final_stats) : null, id]
    );
  }

  static async updateLastSeen(id: string): Promise<void> {
    await pool.query('UPDATE labyrinth_participants SET last_seen = CURRENT_TIMESTAMP WHERE id = $1', [id]);
  }

  static async countByFloor(labyrinth_id: string, floor_number: number): Promise<number> {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM labyrinth_participants WHERE labyrinth_id = $1 AND floor_number = $2 AND status = $3',
      [labyrinth_id, floor_number, 'active']
    );
    return parseInt(result.rows[0].count, 10);
  }

  static async findByCharacter(character_id: string, status?: ParticipantStatus): Promise<LabyrinthParticipant[]> {
    let query = 'SELECT * FROM labyrinth_participants WHERE character_id = $1';
    const params: any[] = [character_id];
    
    if (status) {
      query += ' AND status = $2';
      params.push(status);
    } else {
      // Only return active participants by default
      query += ' AND status = $2';
      params.push('active');
    }
    
    query += ' ORDER BY joined_at DESC';
    
    const result = await pool.query(query, params);
    return result.rows.map((row) => this.mapRowToParticipant(row));
  }

  private static mapRowToParticipant(row: any): LabyrinthParticipant {
    return {
      id: row.id,
      labyrinth_id: row.labyrinth_id,
      character_id: row.character_id,
      party_id: row.party_id,
      floor_number: row.floor_number,
      status: row.status,
      eliminated_at: row.eliminated_at,
      eliminated_by: row.eliminated_by,
      final_stats: typeof row.final_stats === 'string' ? JSON.parse(row.final_stats) : row.final_stats,
      joined_at: row.joined_at,
      last_seen: row.last_seen,
    };
  }
}

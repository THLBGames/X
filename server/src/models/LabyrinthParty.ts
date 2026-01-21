import { pool } from '../config/database.js';

export type PartyStatus = 'active' | 'eliminated' | 'winner';

export interface LabyrinthParty {
  id: string;
  labyrinth_id: string;
  name: string | null;
  leader_character_id: string;
  members: string[];
  floor_number: number;
  status: PartyStatus;
  created_at: Date;
}

export interface CreatePartyInput {
  labyrinth_id: string;
  leader_character_id: string;
  name?: string | null;
  members?: string[];
}

export class LabyrinthPartyModel {
  static async create(input: CreatePartyInput): Promise<LabyrinthParty> {
    const members = input.members || [input.leader_character_id];
    const result = await pool.query(
      `INSERT INTO labyrinth_parties (labyrinth_id, name, leader_character_id, members, floor_number)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.labyrinth_id, input.name || null, input.leader_character_id, JSON.stringify(members), 1]
    );
    return this.mapRowToParty(result.rows[0]);
  }

  static async findById(id: string): Promise<LabyrinthParty | null> {
    const result = await pool.query('SELECT * FROM labyrinth_parties WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToParty(result.rows[0]);
  }

  static async findByLabyrinthId(labyrinth_id: string): Promise<LabyrinthParty[]> {
    const result = await pool.query(
      'SELECT * FROM labyrinth_parties WHERE labyrinth_id = $1 AND status = $2',
      [labyrinth_id, 'active']
    );
    return result.rows.map((row) => this.mapRowToParty(row));
  }

  static async addMember(id: string, character_id: string): Promise<void> {
    const party = await this.findById(id);
    if (!party) throw new Error('Party not found');

    if (party.members.includes(character_id)) {
      return; // Already a member
    }

    const updatedMembers = [...party.members, character_id];
    await pool.query('UPDATE labyrinth_parties SET members = $1 WHERE id = $2', [JSON.stringify(updatedMembers), id]);
  }

  static async removeMember(id: string, character_id: string): Promise<void> {
    const party = await this.findById(id);
    if (!party) throw new Error('Party not found');

    const updatedMembers = party.members.filter((id) => id !== character_id);
    await pool.query('UPDATE labyrinth_parties SET members = $1 WHERE id = $2', [JSON.stringify(updatedMembers), id]);
  }

  static async updateStatus(id: string, status: PartyStatus): Promise<void> {
    await pool.query('UPDATE labyrinth_parties SET status = $1 WHERE id = $2', [status, id]);
  }

  static async updateFloor(id: string, floor_number: number): Promise<void> {
    await pool.query('UPDATE labyrinth_parties SET floor_number = $1 WHERE id = $2', [floor_number, id]);
  }

  private static mapRowToParty(row: any): LabyrinthParty {
    return {
      id: row.id,
      labyrinth_id: row.labyrinth_id,
      name: row.name,
      leader_character_id: row.leader_character_id,
      members: typeof row.members === 'string' ? JSON.parse(row.members) : row.members,
      floor_number: row.floor_number,
      status: row.status,
      created_at: row.created_at,
    };
  }
}

// Labyrinth-related types shared between client and server

export type LabyrinthStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';
export type ParticipantStatus = 'active' | 'eliminated' | 'winner';
export type PartyStatus = 'active' | 'eliminated' | 'winner';
export type CombatType = 'pvp' | 'pve' | 'mixed';

export interface Labyrinth {
  id: string;
  name: string;
  status: LabyrinthStatus;
  scheduled_start: string;
  actual_start: string | null;
  completed_at: string | null;
  total_floors: number;
  max_initial_players: number;
  rules_config: Record<string, any>;
  winner_character_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface LabyrinthFloor {
  id: string;
  labyrinth_id: string;
  floor_number: number;
  max_players: number;
  monster_pool: any[];
  loot_table: any[];
  environment_type: string;
  rules: Record<string, any>;
  time_limit_hours: number | null;
  movement_regen_rate: number | null;
  max_movement_points: number | null;
  completed_at: string | null;
  created_at: string;
}

export type NodeType = 'boss' | 'monster_spawn' | 'monster_spawner' | 'safe_zone' | 'crafting' | 'stairs' | 'regular' | 'guild_hall';

export interface FloorNode {
  id: string;
  floor_id: string;
  node_type: NodeType;
  x_coordinate: number;
  y_coordinate: number;
  name: string | null;
  description: string | null;
  metadata: Record<string, any>;
  required_boss_defeated: string | null;
  is_revealed: boolean;
  is_start_point: boolean;
  leads_to_floor_number: number | null;
  capacity_limit: number | null;
  created_at: string;
}

export interface FloorConnection {
  id: string;
  floor_id: string;
  from_node_id: string;
  to_node_id: string;
  movement_cost: number;
  is_bidirectional: boolean;
  required_item: string | null;
  visibility_requirement: Record<string, any> | null;
  created_at: string;
}

export interface ParticipantPosition {
  id: string;
  participant_id: string;
  floor_id: string;
  current_node_id: string | null;
  movement_points: number;
  max_movement_points: number;
  last_movement_time: string;
  explored_nodes: string[];
  floor_joined_at: string;
  movement_history: Array<{ node_id: string; timestamp: string; movement_cost: number }>;
  created_at: string;
  updated_at: string;
}

export interface LabyrinthParticipant {
  id: string;
  labyrinth_id: string;
  character_id: string;
  party_id: string | null;
  floor_number: number;
  status: ParticipantStatus;
  eliminated_at: string | null;
  eliminated_by: string | null;
  final_stats: Record<string, any> | null;
  joined_at: string;
  last_seen: string;
}

export interface LabyrinthParty {
  id: string;
  labyrinth_id: string;
  name: string | null;
  leader_character_id: string;
  members: string[];
  floor_number: number;
  status: PartyStatus;
  created_at: string;
}

export interface LabyrinthReward {
  id: string;
  labyrinth_id: string;
  character_id: string;
  reward_type: 'title' | 'achievement' | 'skill' | 'loot_box' | 'item' | 'gold';
  reward_id: string;
  quantity: number;
  earned_at: string;
  claimed: boolean;
}

-- Extend labyrinth_floors table with movement and time limit fields
ALTER TABLE labyrinth_floors 
ADD COLUMN IF NOT EXISTS time_limit_hours INTEGER DEFAULT 120, -- Default 5 days (120 hours)
ADD COLUMN IF NOT EXISTS movement_regen_rate DECIMAL(10,2) DEFAULT 1.0, -- Points per hour
ADD COLUMN IF NOT EXISTS max_movement_points INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS start_node_id UUID;

-- Create floor nodes table (rooms/areas on floors)
CREATE TABLE IF NOT EXISTS labyrinth_floor_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id UUID NOT NULL REFERENCES labyrinth_floors(id) ON DELETE CASCADE,
  node_type VARCHAR(50) NOT NULL CHECK (node_type IN ('boss', 'monster_spawn', 'safe_zone', 'crafting', 'stairs', 'regular')),
  x_coordinate DECIMAL(10,2) NOT NULL,
  y_coordinate DECIMAL(10,2) NOT NULL,
  name VARCHAR(255),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  required_boss_defeated UUID REFERENCES labyrinth_floor_nodes(id), -- For boss-locked stairs
  is_revealed BOOLEAN DEFAULT false,
  leads_to_floor_number INTEGER, -- For stairs nodes
  capacity_limit INTEGER, -- For stairs (null = unlimited)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(floor_id, x_coordinate, y_coordinate)
);

-- Create index on floor_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_floor_nodes_floor_id ON labyrinth_floor_nodes(floor_id);
CREATE INDEX IF NOT EXISTS idx_floor_nodes_type ON labyrinth_floor_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_floor_nodes_stairs ON labyrinth_floor_nodes(floor_id, node_type) WHERE node_type = 'stairs';

-- Create floor connections table (paths between nodes)
CREATE TABLE IF NOT EXISTS labyrinth_floor_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id UUID NOT NULL REFERENCES labyrinth_floors(id) ON DELETE CASCADE,
  from_node_id UUID NOT NULL REFERENCES labyrinth_floor_nodes(id) ON DELETE CASCADE,
  to_node_id UUID NOT NULL REFERENCES labyrinth_floor_nodes(id) ON DELETE CASCADE,
  movement_cost INTEGER DEFAULT 1,
  is_bidirectional BOOLEAN DEFAULT true,
  required_item VARCHAR(255), -- Optional key/item to unlock
  visibility_requirement JSONB, -- Requirements for visibility
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (from_node_id != to_node_id),
  UNIQUE(floor_id, from_node_id, to_node_id)
);

-- Create index on floor_id and nodes for fast lookups
CREATE INDEX IF NOT EXISTS idx_floor_connections_floor_id ON labyrinth_floor_connections(floor_id);
CREATE INDEX IF NOT EXISTS idx_floor_connections_from_node ON labyrinth_floor_connections(from_node_id);
CREATE INDEX IF NOT EXISTS idx_floor_connections_to_node ON labyrinth_floor_connections(to_node_id);

-- Create participant positions table
CREATE TABLE IF NOT EXISTS labyrinth_participant_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES labyrinth_participants(id) ON DELETE CASCADE,
  floor_id UUID NOT NULL REFERENCES labyrinth_floors(id) ON DELETE CASCADE,
  current_node_id UUID REFERENCES labyrinth_floor_nodes(id),
  movement_points DECIMAL(10,2) DEFAULT 0,
  max_movement_points INTEGER DEFAULT 10,
  last_movement_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  explored_nodes JSONB DEFAULT '[]',
  floor_joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  movement_history JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(participant_id, floor_id)
);

-- Create indexes for position lookups
CREATE INDEX IF NOT EXISTS idx_participant_positions_participant ON labyrinth_participant_positions(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_positions_floor ON labyrinth_participant_positions(floor_id);
CREATE INDEX IF NOT EXISTS idx_participant_positions_node ON labyrinth_participant_positions(current_node_id);

-- Create stair usage tracking table
CREATE TABLE IF NOT EXISTS labyrinth_stair_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stair_node_id UUID NOT NULL REFERENCES labyrinth_floor_nodes(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES labyrinth_participants(id) ON DELETE CASCADE,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(stair_node_id, participant_id)
);

-- Create index on stair usage
CREATE INDEX IF NOT EXISTS idx_stair_usage_node ON labyrinth_stair_usage(stair_node_id);
CREATE INDEX IF NOT EXISTS idx_stair_usage_participant ON labyrinth_stair_usage(participant_id);

-- Add foreign key constraint for start_node_id in labyrinth_floors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'labyrinth_floors_start_node_id_fkey'
  ) THEN
    ALTER TABLE labyrinth_floors
    ADD CONSTRAINT labyrinth_floors_start_node_id_fkey
    FOREIGN KEY (start_node_id) REFERENCES labyrinth_floor_nodes(id);
  END IF;
END $$;

-- Create enums (idempotent)
DO $$ BEGIN
    CREATE TYPE labyrinth_status AS ENUM ('scheduled', 'active', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE participant_status AS ENUM ('active', 'eliminated', 'winner');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE party_status AS ENUM ('active', 'eliminated', 'winner');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE combat_type AS ENUM ('pvp', 'pve', 'mixed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE combat_instance_status AS ENUM ('active', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reward_type AS ENUM ('title', 'achievement', 'skill', 'loot_box', 'item', 'gold');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Labyrinths table
CREATE TABLE IF NOT EXISTS labyrinths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    status labyrinth_status NOT NULL DEFAULT 'scheduled',
    scheduled_start TIMESTAMP NOT NULL,
    actual_start TIMESTAMP,
    completed_at TIMESTAMP,
    total_floors INTEGER NOT NULL CHECK (total_floors > 0),
    max_initial_players INTEGER NOT NULL CHECK (max_initial_players > 0),
    rules_config JSONB NOT NULL DEFAULT '{}',
    winner_character_id VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Labyrinth floors table
CREATE TABLE IF NOT EXISTS labyrinth_floors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    labyrinth_id UUID NOT NULL REFERENCES labyrinths(id) ON DELETE CASCADE,
    floor_number INTEGER NOT NULL CHECK (floor_number > 0),
    max_players INTEGER NOT NULL CHECK (max_players > 0),
    monster_pool JSONB NOT NULL DEFAULT '[]',
    loot_table JSONB NOT NULL DEFAULT '[]',
    environment_type VARCHAR(100) NOT NULL DEFAULT 'dungeon',
    rules JSONB NOT NULL DEFAULT '{}',
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(labyrinth_id, floor_number)
);

-- Labyrinth participants table
CREATE TABLE IF NOT EXISTS labyrinth_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    labyrinth_id UUID NOT NULL REFERENCES labyrinths(id) ON DELETE CASCADE,
    character_id VARCHAR(255) NOT NULL,
    party_id UUID,
    floor_number INTEGER NOT NULL DEFAULT 1,
    status participant_status NOT NULL DEFAULT 'active',
    eliminated_at TIMESTAMP,
    eliminated_by VARCHAR(255),
    final_stats JSONB,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Labyrinth parties table
CREATE TABLE IF NOT EXISTS labyrinth_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    labyrinth_id UUID NOT NULL REFERENCES labyrinths(id) ON DELETE CASCADE,
    name VARCHAR(255),
    leader_character_id VARCHAR(255) NOT NULL,
    members JSONB NOT NULL DEFAULT '[]',
    floor_number INTEGER NOT NULL DEFAULT 1,
    status party_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Labyrinth events table
CREATE TABLE IF NOT EXISTS labyrinth_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    labyrinth_id UUID NOT NULL REFERENCES labyrinths(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    character_id VARCHAR(255),
    party_id UUID,
    data JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Labyrinth combat instances table
CREATE TABLE IF NOT EXISTS labyrinth_combat_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    labyrinth_id UUID NOT NULL REFERENCES labyrinths(id) ON DELETE CASCADE,
    floor_number INTEGER NOT NULL,
    participant_ids JSONB NOT NULL DEFAULT '[]',
    combat_type combat_type NOT NULL,
    status combat_instance_status NOT NULL DEFAULT 'active',
    result JSONB,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Labyrinth rewards table
CREATE TABLE IF NOT EXISTS labyrinth_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    labyrinth_id UUID NOT NULL REFERENCES labyrinths(id) ON DELETE CASCADE,
    character_id VARCHAR(255) NOT NULL,
    reward_type reward_type NOT NULL,
    reward_id VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    earned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    claimed BOOLEAN NOT NULL DEFAULT false
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_labyrinths_status ON labyrinths(status);
CREATE INDEX IF NOT EXISTS idx_labyrinths_scheduled_start ON labyrinths(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_labyrinth_floors_labyrinth_id ON labyrinth_floors(labyrinth_id);
CREATE INDEX IF NOT EXISTS idx_labyrinth_participants_labyrinth_id ON labyrinth_participants(labyrinth_id);
CREATE INDEX IF NOT EXISTS idx_labyrinth_participants_character_id ON labyrinth_participants(character_id);
CREATE INDEX IF NOT EXISTS idx_labyrinth_participants_status ON labyrinth_participants(status);
CREATE INDEX IF NOT EXISTS idx_labyrinth_participants_floor ON labyrinth_participants(labyrinth_id, floor_number);
CREATE INDEX IF NOT EXISTS idx_labyrinth_parties_labyrinth_id ON labyrinth_parties(labyrinth_id);
CREATE INDEX IF NOT EXISTS idx_labyrinth_parties_status ON labyrinth_parties(status);
CREATE INDEX IF NOT EXISTS idx_labyrinth_events_labyrinth_id ON labyrinth_events(labyrinth_id);
CREATE INDEX IF NOT EXISTS idx_labyrinth_events_timestamp ON labyrinth_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_labyrinth_combat_instances_labyrinth_id ON labyrinth_combat_instances(labyrinth_id);
CREATE INDEX IF NOT EXISTS idx_labyrinth_combat_instances_status ON labyrinth_combat_instances(status);
CREATE INDEX IF NOT EXISTS idx_labyrinth_rewards_labyrinth_id ON labyrinth_rewards(labyrinth_id);
CREATE INDEX IF NOT EXISTS idx_labyrinth_rewards_character_id ON labyrinth_rewards(character_id);
CREATE INDEX IF NOT EXISTS idx_labyrinth_rewards_claimed ON labyrinth_rewards(claimed);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for labyrinths table
DROP TRIGGER IF EXISTS update_labyrinths_updated_at ON labyrinths;
CREATE TRIGGER update_labyrinths_updated_at BEFORE UPDATE ON labyrinths
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

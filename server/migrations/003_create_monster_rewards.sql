-- Create global monster rewards table
CREATE TABLE IF NOT EXISTS global_monster_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monster_id VARCHAR(255) NOT NULL,
  reward_type VARCHAR(50) NOT NULL, -- 'item', 'gold', 'experience', 'title', 'achievement'
  reward_id VARCHAR(255) NOT NULL,
  quantity INTEGER DEFAULT 1,
  chance DECIMAL(5,4) DEFAULT 1.0, -- 0.0000 to 1.0000
  min_quantity INTEGER,
  max_quantity INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(monster_id, reward_type, reward_id)
);

-- Create index on monster_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_global_monster_rewards_monster_id ON global_monster_rewards(monster_id);

-- Create floor-specific monster rewards table (overrides)
CREATE TABLE IF NOT EXISTS floor_monster_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id UUID NOT NULL REFERENCES labyrinth_floors(id) ON DELETE CASCADE,
  monster_id VARCHAR(255) NOT NULL,
  reward_type VARCHAR(50) NOT NULL,
  reward_id VARCHAR(255) NOT NULL,
  quantity INTEGER DEFAULT 1,
  chance DECIMAL(5,4) DEFAULT 1.0,
  min_quantity INTEGER,
  max_quantity INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(floor_id, monster_id, reward_type, reward_id)
);

-- Create index on floor_id and monster_id
CREATE INDEX IF NOT EXISTS idx_floor_monster_rewards_floor_id ON floor_monster_rewards(floor_id);
CREATE INDEX IF NOT EXISTS idx_floor_monster_rewards_monster_id ON floor_monster_rewards(monster_id);

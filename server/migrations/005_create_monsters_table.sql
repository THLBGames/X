-- Create monsters table
CREATE TABLE IF NOT EXISTS monsters (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  name_key VARCHAR(255),
  description_key VARCHAR(255),
  tier INTEGER NOT NULL,
  level INTEGER NOT NULL,
  stats JSONB NOT NULL,
  abilities JSONB DEFAULT '[]',
  loot_table JSONB NOT NULL DEFAULT '[]',
  experience_reward INTEGER NOT NULL,
  gold_reward JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_monsters_tier ON monsters(tier);
CREATE INDEX IF NOT EXISTS idx_monsters_level ON monsters(level);
CREATE INDEX IF NOT EXISTS idx_monsters_tier_level ON monsters(tier, level);

-- Create trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_monsters_updated_at ON monsters;
CREATE TRIGGER update_monsters_updated_at BEFORE UPDATE ON monsters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

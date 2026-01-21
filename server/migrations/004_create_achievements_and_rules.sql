-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  requirements JSONB NOT NULL DEFAULT '{}',
  rewards JSONB NOT NULL DEFAULT '{}',
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create global_rules table (single row configuration)
CREATE TABLE IF NOT EXISTS global_rules (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
  rules JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT single_row CHECK (id = 'default')
);

-- Create indexes for achievements
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
CREATE INDEX IF NOT EXISTS idx_achievements_hidden ON achievements(hidden);

-- Create trigger to update updated_at timestamp for achievements
DROP TRIGGER IF EXISTS update_achievements_updated_at ON achievements;
CREATE TRIGGER update_achievements_updated_at BEFORE UPDATE ON achievements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to update updated_at timestamp for global_rules
DROP TRIGGER IF EXISTS update_global_rules_updated_at ON global_rules;
CREATE TRIGGER update_global_rules_updated_at BEFORE UPDATE ON global_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default global rules if not exists
INSERT INTO global_rules (id, rules)
VALUES (
  'default',
  '{
    "max_party_size": 4,
    "pvp_enabled": true,
    "permadeath": true,
    "floor_progression": {
      "elimination_rules": "last_player_standing"
    },
    "combat": {
      "turn_based": true,
      "turn_timeout_seconds": 30
    },
    "rewards": {
      "participation_reward": true,
      "floor_based_rewards": true,
      "ranking_rewards": true
    }
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Create items table
CREATE TABLE IF NOT EXISTS items (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  name_key VARCHAR(255),
  description_key VARCHAR(255),
  type VARCHAR(50) NOT NULL,
  rarity VARCHAR(50) NOT NULL,
  stackable BOOLEAN NOT NULL DEFAULT true,
  max_stack INTEGER,
  value INTEGER NOT NULL DEFAULT 0,
  requirements JSONB DEFAULT '{}',
  equipment_slot VARCHAR(50),
  stat_bonuses JSONB DEFAULT '{}',
  combat_stat_bonuses JSONB DEFAULT '{}',
  consumable_effect JSONB,
  max_enchantments INTEGER,
  enchantment_slots INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for items
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_rarity ON items(rarity);
CREATE INDEX IF NOT EXISTS idx_items_type_rarity ON items(type, rarity);
CREATE INDEX IF NOT EXISTS idx_items_equipment_slot ON items(equipment_slot) WHERE equipment_slot IS NOT NULL;

-- Create classes table
CREATE TABLE IF NOT EXISTS classes (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  name_key VARCHAR(255),
  description_key VARCHAR(255),
  parent_class VARCHAR(255),
  unlock_level INTEGER,
  is_subclass BOOLEAN DEFAULT false,
  required_quest_id VARCHAR(255),
  base_stats JSONB NOT NULL,
  stat_growth JSONB NOT NULL,
  available_skills JSONB DEFAULT '[]',
  equipment_restrictions JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for classes
CREATE INDEX IF NOT EXISTS idx_classes_parent_class ON classes(parent_class) WHERE parent_class IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_classes_is_subclass ON classes(is_subclass);

-- Create skills table
CREATE TABLE IF NOT EXISTS skills (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  name_key VARCHAR(255),
  description_key VARCHAR(255),
  type VARCHAR(50) NOT NULL,
  category VARCHAR(50),
  max_level INTEGER NOT NULL,
  experience_formula TEXT,
  prerequisites JSONB DEFAULT '[]',
  requirements JSONB DEFAULT '{}',
  mana_cost INTEGER,
  cooldown INTEGER,
  target VARCHAR(50),
  effect JSONB DEFAULT '{}',
  passive_bonus JSONB,
  resource_nodes JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for skills
CREATE INDEX IF NOT EXISTS idx_skills_type ON skills(type);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category) WHERE category IS NOT NULL;

-- Create dungeons table
CREATE TABLE IF NOT EXISTS dungeons (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  name_key VARCHAR(255),
  description_key VARCHAR(255),
  tier INTEGER NOT NULL,
  required_level INTEGER,
  required_dungeon_id VARCHAR(255),
  monster_pools JSONB NOT NULL DEFAULT '[]',
  rewards JSONB NOT NULL DEFAULT '{}',
  unlock_conditions JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for dungeons
CREATE INDEX IF NOT EXISTS idx_dungeons_tier ON dungeons(tier);
CREATE INDEX IF NOT EXISTS idx_dungeons_required_level ON dungeons(required_level) WHERE required_level IS NOT NULL;

-- Create quests table
CREATE TABLE IF NOT EXISTS quests (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  name_key VARCHAR(255),
  description_key VARCHAR(255),
  type VARCHAR(50),
  category VARCHAR(50),
  required_level INTEGER,
  required_class VARCHAR(255),
  prerequisites JSONB DEFAULT '[]',
  objectives JSONB NOT NULL DEFAULT '[]',
  rewards JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for quests
CREATE INDEX IF NOT EXISTS idx_quests_type ON quests(type) WHERE type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quests_category ON quests(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quests_required_level ON quests(required_level) WHERE required_level IS NOT NULL;

-- Create triggers to update updated_at timestamp
DROP TRIGGER IF EXISTS update_items_updated_at ON items;
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_classes_updated_at ON classes;
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_skills_updated_at ON skills;
CREATE TRIGGER update_skills_updated_at BEFORE UPDATE ON skills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dungeons_updated_at ON dungeons;
CREATE TRIGGER update_dungeons_updated_at BEFORE UPDATE ON dungeons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quests_updated_at ON quests;
CREATE TRIGGER update_quests_updated_at BEFORE UPDATE ON quests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

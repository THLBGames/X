# Complete Data Migration Guide

This guide explains how to migrate all game data from JSON files to the database.

## Overview

All game data has been converted from JSON file storage to database storage. This provides:
- Better querying and filtering capabilities
- Full CRUD operations through the admin UI
- Data consistency and validation
- Easier management and updates
- Better performance for large datasets

## Migration Steps

### 1. Run the Database Migration

First, create all the necessary tables:

```bash
cd server
npm run migrate
```

This will run all migrations including:
- `004_create_achievements_and_rules.sql` - Achievements and rules
- `005_create_monsters_table.sql` - Monsters
- `006_create_game_data_tables.sql` - Items, Classes, Skills, Dungeons, Quests

### 2. Import All Existing Data

Import all data from JSON files into the database:

```bash
cd server
npm run import-all-data
```

This script will:
- Import all classes from `data/classes/classes.json`
- Import all items from `data/items/*.json` (968+ files)
- Import all skills from `data/skills/*.json` (125+ files)
- Import all dungeons from `data/dungeons/*.json` (11+ files)
- Import all quests from `data/quests/quests.json` and individual quest files

**Note:** The import script uses transactions and handles conflicts safely, so running it multiple times is safe.

### 3. Import Monsters (if not already done)

If you haven't imported monsters yet:

```bash
cd server
npm run import-monsters
```

## Database Schema

### Items Table
- Stores all item definitions (weapons, armor, consumables, materials, etc.)
- JSONB fields: requirements, stat_bonuses, combat_stat_bonuses, consumable_effect
- Indexed by: type, rarity, equipment_slot

### Classes Table
- Stores character class definitions
- JSONB fields: base_stats, stat_growth, available_skills, equipment_restrictions
- Supports parent classes and subclasses

### Skills Table
- Stores skill definitions (active, passive, gathering, crafting, etc.)
- JSONB fields: prerequisites, requirements, effect, passive_bonus, resource_nodes
- Indexed by: type, category

### Dungeons Table
- Stores dungeon/zone definitions
- JSONB fields: monster_pools, rewards, unlock_conditions
- Indexed by: tier, required_level

### Quests Table
- Stores quest definitions
- JSONB fields: prerequisites, objectives, rewards
- Indexed by: type, category, required_level

### Monsters Table
- Stores monster definitions (already migrated)
- JSONB fields: stats, abilities, loot_table, gold_reward

### Achievements Table
- Stores achievement definitions (already migrated)
- JSONB fields: requirements, rewards

### Global Rules Table
- Stores global game rules configuration (already migrated)
- JSONB field: rules

## Data Preservation

**Important:** The original JSON files in the `data/` directory are kept as reference/backup but are **no longer used by the application**. The database is now the source of truth for all game data.

## Admin UI

The admin panel now supports full CRUD operations for:
- ✅ Monsters
- ✅ Monster Rewards
- ✅ Achievements
- ✅ Rules
- ✅ Users
- 🔄 Items (API ready, UI can be added)
- 🔄 Classes (API ready, UI can be added)
- 🔄 Skills (API ready, UI can be added)
- 🔄 Dungeons (API ready, UI can be added)
- 🔄 Quests (API ready, UI can be added)

## API Endpoints

All data types now have database-backed API endpoints:

### Items
- `GET /api/admin/items` - List all items
- `GET /api/admin/items/:id` - Get single item
- `POST /api/admin/items` - Create item
- `PUT /api/admin/items/:id` - Update item
- `DELETE /api/admin/items/:id` - Delete item

### Classes
- `GET /api/admin/classes` - List all classes
- `GET /api/admin/classes/:id` - Get single class
- `POST /api/admin/classes` - Create class
- `PUT /api/admin/classes/:id` - Update class
- `DELETE /api/admin/classes/:id` - Delete class

### Skills
- `GET /api/admin/skills` - List all skills
- `GET /api/admin/skills/:id` - Get single skill
- `POST /api/admin/skills` - Create skill
- `PUT /api/admin/skills/:id` - Update skill
- `DELETE /api/admin/skills/:id` - Delete skill

### Dungeons
- `GET /api/admin/dungeons` - List all dungeons
- `GET /api/admin/dungeons/:id` - Get single dungeon
- `POST /api/admin/dungeons` - Create dungeon
- `PUT /api/admin/dungeons/:id` - Update dungeon
- `DELETE /api/admin/dungeons/:id` - Delete dungeon

### Quests
- `GET /api/admin/quests` - List all quests
- `GET /api/admin/quests/:id` - Get single quest
- `POST /api/admin/quests` - Create quest
- `PUT /api/admin/quests/:id` - Update quest
- `DELETE /api/admin/quests/:id` - Delete quest

All endpoints require authentication via JWT token.

## Performance Notes

- All JSONB fields are indexed for efficient querying
- Bulk import operations use transactions for data integrity
- The import script processes items in batches with progress indicators
- Large datasets (like 968 items) are handled efficiently with proper indexing

## Troubleshooting

### Import fails with "relation does not exist"
Make sure you've run the migrations first: `npm run migrate`

### Import is slow
This is normal for large datasets. The script shows progress every 100 items.

### Some items fail to import
Check the error messages - they will indicate which items have issues. Common problems:
- Missing required fields
- Invalid JSON in nested fields
- Data type mismatches

### Need to re-import
The import scripts use `ON CONFLICT DO UPDATE`, so you can safely re-run them to update existing data.

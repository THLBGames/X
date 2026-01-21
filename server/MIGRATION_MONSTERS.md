# Monster Data Migration Guide

This guide explains how to migrate monster data from JSON files to the database.

## Overview

Monsters have been converted from JSON file storage to database storage. This provides:
- Better querying and filtering capabilities
- Full CRUD operations through the admin UI
- Data consistency and validation
- Easier management and updates

## Migration Steps

### 1. Run the Database Migration

First, create the monsters table:

```bash
cd server
npm run migrate
```

This will run all migrations including the new `005_create_monsters_table.sql`.

### 2. Import Existing Monster Data

Import all monsters from the JSON file into the database:

```bash
cd server
npm run import-monsters
```

This script reads from `data/monsters/monsters.json` and imports all monsters into the database.

## Database Schema

The `monsters` table includes:
- `id` (VARCHAR, PRIMARY KEY) - Unique monster identifier
- `name` (VARCHAR) - Monster display name
- `description` (TEXT) - Monster description
- `name_key` (VARCHAR) - Translation key for name
- `description_key` (VARCHAR) - Translation key for description
- `tier` (INTEGER) - Monster tier (1-3)
- `level` (INTEGER) - Monster level
- `stats` (JSONB) - Combat stats (health, attack, defense, etc.)
- `abilities` (JSONB) - Monster abilities array
- `loot_table` (JSONB) - Loot table array
- `experience_reward` (INTEGER) - Experience points awarded
- `gold_reward` (JSONB) - Gold reward range {min, max}
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

## API Changes

The admin API now uses the database instead of JSON files:

- `GET /api/admin/monsters` - List all monsters (from database)
- `GET /api/admin/monsters/:id` - Get single monster (from database)
- `POST /api/admin/monsters` - Create new monster
- `PUT /api/admin/monsters/:id` - Update monster
- `DELETE /api/admin/monsters/:id` - Delete monster

## Admin UI

The Monster Manager in the admin panel now supports full CRUD operations:
- View all monsters
- Create new monsters
- Edit existing monsters
- Delete monsters
- Configure monster rewards

## JSON Files

The original JSON files in `data/monsters/` are kept as reference/backup but are no longer used by the application. The database is now the source of truth for monster data.

## Notes

- The import script uses `ON CONFLICT DO UPDATE`, so running it multiple times is safe
- Monster IDs must be unique
- All JSON fields (stats, abilities, loot_table, gold_reward) are stored as JSONB for efficient querying
- Indexes are created on tier and level for fast filtering

# Game Data Directory

This directory contains all game data in JSON format. The data is loaded at runtime and drives all game content.

## Directory Structure

- `classes/` - Character class definitions
- `monsters/` - Monster definitions (hundreds of monsters)
- `items/` - Item definitions (thousands of items)
- `skills/` - Skill definitions (20+ skills)
- `dungeons/` - Dungeon/zone definitions
- `config/` - Game configuration files
- `schemas/` - JSON schemas for validation

## File Naming Convention

- Use lowercase with underscores: `goblin_warrior.json`
- Use the entity ID as the filename: `{id}.json`

## Data Format

All JSON files should match their corresponding schema in `schemas/`. See the schema files for detailed structure requirements.


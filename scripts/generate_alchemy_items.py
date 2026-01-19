#!/usr/bin/env python3
"""
Generate alchemy potion item JSON files for all recipes
"""

import json
import os

# Read alchemy recipes
with open('data/skills/alchemy.json', 'r') as f:
    alchemy_data = json.load(f)

recipes = alchemy_data['recipes']

# Determine rarity based on recipe level
def get_rarity(level):
    if level < 20:
        return "common"
    elif level < 40:
        return "uncommon"
    elif level < 60:
        return "rare"
    elif level < 80:
        return "epic"
    elif level < 95:
        return "legendary"
    else:
        return "mythic"

# Determine value based on rarity and level
def get_value(level, rarity):
    base_values = {
        "common": 50,
        "uncommon": 100,
        "rare": 250,
        "epic": 500,
        "legendary": 1000,
        "mythic": 2500
    }
    return base_values.get(rarity, 100) + (level * 5)

# Generate item from recipe
def generate_item(recipe):
    item_id = recipe['result']['itemId']
    level = recipe.get('level', 1)
    rarity = get_rarity(level)
    value = get_value(level, rarity)
    
    # Determine consumable effect based on item name/type
    effect = {"type": "buff"}
    
    # XP potions
    if 'xp_potion' in item_id.lower() or '_xp_' in item_id:
        effect = {"type": "experience", "amount": 200 + (level * 10)}
    # Health potions
    elif 'health' in item_id.lower() or 'heal' in item_id.lower():
        effect = {"type": "heal", "amount": 50 + (level * 10)}
    # Mana potions
    elif 'mana' in item_id.lower():
        effect = {"type": "mana", "amount": 30 + (level * 5)}
    # Stat potions
    elif any(stat in item_id.lower() for stat in ['strength', 'vitality', 'dexterity', 'intelligence', 'wisdom', 'luck']):
        stat_name = item_id.replace('_potion', '').replace('_advanced', '').replace('_elixir', '')
        effect = {"type": "buff", "buffId": f"{stat_name}_boost", "duration": 300 + (level * 10)}
    # Combat potions
    elif any(cmb in item_id.lower() for cmb in ['attack', 'defense', 'critical', 'speed']):
        buff_name = item_id.replace('_potion', '').replace('_mastery', '').replace('_boost', '')
        effect = {"type": "buff", "buffId": f"{buff_name}_boost", "duration": 300 + (level * 10)}
    # Utility potions
    elif 'gold' in item_id.lower() or 'item_find' in item_id.lower() or 'offline' in item_id.lower():
        effect = {"type": "buff", "buffId": f"{item_id}_buff", "duration": 3600 + (level * 60)}
    # Default to buff
    else:
        effect = {"type": "buff", "buffId": f"{item_id}_buff", "duration": 300 + (level * 10)}
    
    item = {
        "id": item_id,
        "name": recipe['name'],
        "description": f"An alchemy-crafted {recipe['name'].lower()}.",
        "type": "consumable",
        "rarity": rarity,
        "stackable": True,
        "maxStack": 99,
        "value": value,
        "consumableEffect": effect,
        "nameKey": f"item.{item_id}.name",
        "descriptionKey": f"item.{item_id}.description"
    }
    
    return item

# Check existing items
existing_items = set()
items_dir = 'data/items'
if os.path.exists(items_dir):
    existing_items = {f.replace('.json', '') for f in os.listdir(items_dir) if f.endswith('.json')}

# Generate items
items_to_create = {}
for recipe in recipes:
    item_id = recipe['result']['itemId']
    if item_id not in existing_items:
        items_to_create[item_id] = generate_item(recipe)

print(f"Creating {len(items_to_create)} item files...")

# Write items
created = 0
for item_id, item in items_to_create.items():
    filepath = os.path.join(items_dir, f"{item_id}.json")
    with open(filepath, 'w') as f:
        json.dump(item, f, indent=2)
    created += 1

print(f"Created {created} item files successfully!")

#!/usr/bin/env python3
"""
Generate comprehensive alchemy.json with 150+ recipes
"""

import json

recipes = []

# ========== BASIC RECIPES (Levels 1-20) ==========
basic_recipes = [
    {
        "recipeId": "health_potion_basic",
        "name": "Basic Health Potion",
        "level": 1,
        "ingredients": [{"itemId": "common_herb", "quantity": 2}, {"itemId": "water", "quantity": 1}],
        "result": {"itemId": "health_potion_small", "quantity": 1},
        "experienceGain": 15,
        "timeRequired": 4000
    },
    {
        "recipeId": "mana_potion_basic",
        "name": "Basic Mana Potion",
        "level": 3,
        "ingredients": [{"itemId": "common_herb", "quantity": 2}, {"itemId": "energy_wisp", "quantity": 1}],
        "result": {"itemId": "mana_potion_small", "quantity": 1},
        "experienceGain": 25,
        "timeRequired": 4200
    },
    {
        "recipeId": "tree_bark_poultice",
        "name": "Tree Bark Poultice",
        "level": 4,
        "skillPrerequisites": [{"skillId": "woodcutting", "level": 1}],
        "ingredients": [{"itemId": "tree_bark", "quantity": 3}, {"itemId": "common_herb", "quantity": 1}],
        "result": {"itemId": "health_potion_small", "quantity": 1},
        "experienceGain": 18,
        "timeRequired": 3800
    },
    {
        "recipeId": "berry_extract",
        "name": "Berry Extract",
        "level": 5,
        "ingredients": [{"itemId": "berry", "quantity": 5}, {"itemId": "water", "quantity": 1}],
        "result": {"itemId": "health_potion_enhanced", "quantity": 1},
        "experienceGain": 20,
        "timeRequired": 4200
    },
    {
        "recipeId": "pine_resin_balm",
        "name": "Pine Resin Balm",
        "level": 7,
        "skillPrerequisites": [{"skillId": "woodcutting", "level": 15}],
        "ingredients": [{"itemId": "pine_resin", "quantity": 2}, {"itemId": "common_herb", "quantity": 2}],
        "result": {"itemId": "health_potion_enhanced", "quantity": 1},
        "experienceGain": 25,
        "timeRequired": 4200
    },
    {
        "recipeId": "maple_sap_elixir",
        "name": "Maple Sap Elixir",
        "level": 8,
        "skillPrerequisites": [{"skillId": "woodcutting", "level": 20}],
        "ingredients": [{"itemId": "maple_sap", "quantity": 2}, {"itemId": "water", "quantity": 1}],
        "result": {"itemId": "stamina_potion", "quantity": 1},
        "experienceGain": 28,
        "timeRequired": 4500
    },
    {
        "recipeId": "fruit_elixir",
        "name": "Fruit Elixir",
        "level": 12,
        "ingredients": [{"itemId": "fruit", "quantity": 3}, {"itemId": "common_herb", "quantity": 2}],
        "result": {"itemId": "fruit_elixir", "quantity": 1},
        "experienceGain": 40,
        "timeRequired": 4800
    },
    {
        "recipeId": "mana_potion",
        "name": "Mana Potion",
        "level": 15,
        "ingredients": [{"itemId": "uncommon_herb", "quantity": 2}, {"itemId": "energy_wisp", "quantity": 1}],
        "result": {"itemId": "mana_potion_small", "quantity": 1},
        "experienceGain": 50,
        "timeRequired": 5000
    },
    {
        "recipeId": "bone_powder",
        "name": "Bone Powder",
        "level": 15,
        "skillPrerequisites": [{"skillId": "trapping", "level": 10}],
        "ingredients": [{"itemId": "animal_bone", "quantity": 5}, {"itemId": "common_herb", "quantity": 2}],
        "result": {"itemId": "bone_powder", "quantity": 1},
        "experienceGain": 45,
        "timeRequired": 4500
    },
    {
        "recipeId": "stolen_herb_potion",
        "name": "Stolen Herb Potion",
        "level": 18,
        "skillPrerequisites": [{"skillId": "thieving", "level": 15}],
        "ingredients": [{"itemId": "stolen_herb_common", "quantity": 3}, {"itemId": "water", "quantity": 1}, {"itemId": "common_herb", "quantity": 2}],
        "result": {"itemId": "health_potion_enhanced", "quantity": 1},
        "experienceGain": 55,
        "timeRequired": 5000
    }
]
recipes.extend(basic_recipes)

# Continue in next part due to length...

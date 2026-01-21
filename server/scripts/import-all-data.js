import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'idle_rpg',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function importAllData() {
  try {
    await client.connect();
    console.log('Connected to database\n');

    const dataRoot = path.join(__dirname, '../../data');

    // Import Classes
    console.log('=== Importing Classes ===');
    await importClasses(dataRoot);

    // Import Items
    console.log('\n=== Importing Items ===');
    await importItems(dataRoot);

    // Import Skills
    console.log('\n=== Importing Skills ===');
    await importSkills(dataRoot);

    // Import Dungeons
    console.log('\n=== Importing Dungeons ===');
    await importDungeons(dataRoot);

    // Import Quests
    console.log('\n=== Importing Quests ===');
    await importQuests(dataRoot);

    console.log('\n✓ All data imported successfully!');

    await client.end();
  } catch (error) {
    console.error('Import failed:', error);
    await client.end();
    process.exit(1);
  }
}

async function importClasses(dataRoot) {
  const classesPath = path.join(dataRoot, 'classes/classes.json');
  if (!fs.existsSync(classesPath)) {
    console.log('Classes file not found, skipping...');
    return;
  }

  const classesData = JSON.parse(fs.readFileSync(classesPath, 'utf8'));
  const classes = Object.values(classesData.classes || {});

  let imported = 0;
  let failed = 0;

  // Process classes individually
  for (const cls of classes) {
    try {
      // Use individual transaction for each class
      await client.query('BEGIN');
      
      try {
        await client.query(
          `INSERT INTO classes (
            id, name, description, name_key, description_key, parent_class,
            unlock_level, is_subclass, required_quest_id, base_stats,
            stat_growth, available_skills, equipment_restrictions
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            name_key = EXCLUDED.name_key,
            description_key = EXCLUDED.description_key,
            parent_class = EXCLUDED.parent_class,
            unlock_level = EXCLUDED.unlock_level,
            is_subclass = EXCLUDED.is_subclass,
            required_quest_id = EXCLUDED.required_quest_id,
            base_stats = EXCLUDED.base_stats,
            stat_growth = EXCLUDED.stat_growth,
            available_skills = EXCLUDED.available_skills,
            equipment_restrictions = EXCLUDED.equipment_restrictions,
            updated_at = CURRENT_TIMESTAMP`,
          [
            cls.id,
            cls.name,
            cls.description || null,
            cls.nameKey || null,
            cls.descriptionKey || null,
            cls.parentClass || null,
            cls.unlockLevel || null,
            cls.isSubclass ?? false,
            cls.requiredQuestId || null,
            JSON.stringify(cls.baseStats),
            JSON.stringify(cls.statGrowth),
            JSON.stringify(cls.availableSkills || []),
            JSON.stringify(cls.equipmentRestrictions || {}),
          ]
        );
        
        await client.query('COMMIT');
        imported++;
      } catch (dbError) {
        await client.query('ROLLBACK');
        throw dbError;
      }
    } catch (error) {
      failed++;
      console.error(`✗ Failed to import class ${cls.id}:`, error.message);
    }
  }

  console.log(`✓ Imported ${imported}/${classes.length} classes (${failed} failed)`);
}

async function importItems(dataRoot) {
  const itemsDir = path.join(dataRoot, 'items');
  if (!fs.existsSync(itemsDir)) {
    console.log('Items directory not found, skipping...');
    return;
  }

  let imported = 0;
  let failed = 0;

  // First, try to import from combined items.json file if it exists
  const combinedItemsPath = path.join(itemsDir, 'items.json');
  if (fs.existsSync(combinedItemsPath)) {
    try {
      const itemsData = JSON.parse(fs.readFileSync(combinedItemsPath, 'utf8'));
      const items = Object.values(itemsData.items || {});
      
      console.log(`  Found combined items.json with ${items.length} items, importing...`);
      
      for (const item of items) {
        try {
          await client.query('BEGIN');
          
          try {
            await client.query(
              `INSERT INTO items (
                id, name, description, name_key, description_key, type, rarity,
                stackable, max_stack, value, requirements, equipment_slot,
                stat_bonuses, combat_stat_bonuses, consumable_effect,
                max_enchantments, enchantment_slots
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                name_key = EXCLUDED.name_key,
                description_key = EXCLUDED.description_key,
                type = EXCLUDED.type,
                rarity = EXCLUDED.rarity,
                stackable = EXCLUDED.stackable,
                max_stack = EXCLUDED.max_stack,
                value = EXCLUDED.value,
                requirements = EXCLUDED.requirements,
                equipment_slot = EXCLUDED.equipment_slot,
                stat_bonuses = EXCLUDED.stat_bonuses,
                combat_stat_bonuses = EXCLUDED.combat_stat_bonuses,
                consumable_effect = EXCLUDED.consumable_effect,
                max_enchantments = EXCLUDED.max_enchantments,
                enchantment_slots = EXCLUDED.enchantment_slots,
                updated_at = CURRENT_TIMESTAMP`,
              [
                item.id,
                item.name,
                item.description || null,
                item.nameKey || null,
                item.descriptionKey || null,
                item.type,
                item.rarity,
                item.stackable ?? true,
                item.maxStack || null,
                item.value || 0,
                JSON.stringify(item.requirements || {}),
                item.equipmentSlot || null,
                JSON.stringify(item.statBonuses || {}),
                JSON.stringify(item.combatStatBonuses || {}),
                item.consumableEffect ? JSON.stringify(item.consumableEffect) : null,
                item.maxEnchantments || null,
                item.enchantmentSlots || null,
              ]
            );
            
            await client.query('COMMIT');
            imported++;
            if (imported % 100 === 0) {
              process.stdout.write(`\r  Progress: ${imported} items imported...`);
            }
          } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
          }
        } catch (error) {
          failed++;
          console.error(`\n✗ Failed to import item ${item.id}:`, error.message);
        }
      }
    } catch (error) {
      console.error(`✗ Failed to read combined items.json:`, error.message);
    }
  }

  // Also import from individual item files (skip items.json)
  const itemFiles = fs.readdirSync(itemsDir).filter((f) => f.endsWith('.json') && f !== 'items.json');
  
  for (let i = 0; i < itemFiles.length; i++) {
    const file = itemFiles[i];
    
    try {
      // Parse JSON first
      const filePath = path.join(itemsDir, file);
      const item = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Skip if it's a combined file structure
      if (item.items || item.version || item.total_items) {
        continue;
      }

      // Use individual transaction for each item
      await client.query('BEGIN');
      
      try {
        await client.query(
          `INSERT INTO items (
            id, name, description, name_key, description_key, type, rarity,
            stackable, max_stack, value, requirements, equipment_slot,
            stat_bonuses, combat_stat_bonuses, consumable_effect,
            max_enchantments, enchantment_slots
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            name_key = EXCLUDED.name_key,
            description_key = EXCLUDED.description_key,
            type = EXCLUDED.type,
            rarity = EXCLUDED.rarity,
            stackable = EXCLUDED.stackable,
            max_stack = EXCLUDED.max_stack,
            value = EXCLUDED.value,
            requirements = EXCLUDED.requirements,
            equipment_slot = EXCLUDED.equipment_slot,
            stat_bonuses = EXCLUDED.stat_bonuses,
            combat_stat_bonuses = EXCLUDED.combat_stat_bonuses,
            consumable_effect = EXCLUDED.consumable_effect,
            max_enchantments = EXCLUDED.max_enchantments,
            enchantment_slots = EXCLUDED.enchantment_slots,
            updated_at = CURRENT_TIMESTAMP`,
          [
            item.id,
            item.name,
            item.description || null,
            item.nameKey || null,
            item.descriptionKey || null,
            item.type,
            item.rarity,
            item.stackable ?? true,
            item.maxStack || null,
            item.value || 0,
            JSON.stringify(item.requirements || {}),
            item.equipmentSlot || null,
            JSON.stringify(item.statBonuses || {}),
            JSON.stringify(item.combatStatBonuses || {}),
            item.consumableEffect ? JSON.stringify(item.consumableEffect) : null,
            item.maxEnchantments || null,
            item.enchantmentSlots || null,
          ]
        );
        
        await client.query('COMMIT');
        imported++;
      } catch (dbError) {
        await client.query('ROLLBACK');
        throw dbError;
      }
      
      if ((imported + i + 1) % 100 === 0) {
        process.stdout.write(`\r  Progress: ${imported} items imported, ${failed} failed...`);
      }
    } catch (error) {
      failed++;
      console.error(`\n✗ Failed to import item from ${file}:`, error.message);
    }
  }

  console.log(`\n✓ Imported ${imported} items (${failed} failed)`);
}

async function importSkills(dataRoot) {
  const skillsDir = path.join(dataRoot, 'skills');
  if (!fs.existsSync(skillsDir)) {
    console.log('Skills directory not found, skipping...');
    return;
  }

  let imported = 0;
  let failed = 0;

  // First, try to import from combined skills.json file if it exists
  const combinedSkillsPath = path.join(skillsDir, 'skills.json');
  if (fs.existsSync(combinedSkillsPath)) {
    try {
      const skillsData = JSON.parse(fs.readFileSync(combinedSkillsPath, 'utf8'));
      const skills = Object.values(skillsData.skills || {});
      
      console.log(`  Found combined skills.json with ${skills.length} skills, importing...`);
      
      for (const skill of skills) {
        try {
          await client.query('BEGIN');
          
          try {
            await client.query(
              `INSERT INTO skills (
                id, name, description, name_key, description_key, type, category,
                max_level, experience_formula, prerequisites, requirements,
                mana_cost, cooldown, target, effect, passive_bonus, resource_nodes
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                name_key = EXCLUDED.name_key,
                description_key = EXCLUDED.description_key,
                type = EXCLUDED.type,
                category = EXCLUDED.category,
                max_level = EXCLUDED.max_level,
                experience_formula = EXCLUDED.experience_formula,
                prerequisites = EXCLUDED.prerequisites,
                requirements = EXCLUDED.requirements,
                mana_cost = EXCLUDED.mana_cost,
                cooldown = EXCLUDED.cooldown,
                target = EXCLUDED.target,
                effect = EXCLUDED.effect,
                passive_bonus = EXCLUDED.passive_bonus,
                resource_nodes = EXCLUDED.resource_nodes,
                updated_at = CURRENT_TIMESTAMP`,
              [
                skill.id,
                skill.name,
                skill.description || null,
                skill.nameKey || null,
                skill.descriptionKey || null,
                skill.type,
                skill.category || null,
                skill.maxLevel,
                skill.experienceFormula || null,
                JSON.stringify(skill.prerequisites || []),
                JSON.stringify(skill.requirements || {}),
                skill.manaCost || null,
                skill.cooldown || null,
                skill.target || null,
                JSON.stringify(skill.effect || {}),
                skill.passiveBonus ? JSON.stringify(skill.passiveBonus) : null,
                skill.resourceNodes ? JSON.stringify(skill.resourceNodes) : null,
              ]
            );
            
            await client.query('COMMIT');
            imported++;
          } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
          }
        } catch (error) {
          failed++;
          console.error(`✗ Failed to import skill ${skill.id}:`, error.message);
        }
      }
    } catch (error) {
      console.error(`✗ Failed to read combined skills.json:`, error.message);
    }
  }

  // Also import from individual skill files (skip skills.json)
  const skillFiles = fs.readdirSync(skillsDir).filter((f) => f.endsWith('.json') && f !== 'skills.json');
  
  // Process skills individually
  for (const file of skillFiles) {
    try {
      // Parse JSON first
      const filePath = path.join(skillsDir, file);
      const skill = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Skip if it's a combined file structure
      if (skill.skills || skill.version || skill.total_skills) {
        continue;
      }

      // Use individual transaction for each skill
      await client.query('BEGIN');
      
      try {
        await client.query(
          `INSERT INTO skills (
            id, name, description, name_key, description_key, type, category,
            max_level, experience_formula, prerequisites, requirements,
            mana_cost, cooldown, target, effect, passive_bonus, resource_nodes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            name_key = EXCLUDED.name_key,
            description_key = EXCLUDED.description_key,
            type = EXCLUDED.type,
            category = EXCLUDED.category,
            max_level = EXCLUDED.max_level,
            experience_formula = EXCLUDED.experience_formula,
            prerequisites = EXCLUDED.prerequisites,
            requirements = EXCLUDED.requirements,
            mana_cost = EXCLUDED.mana_cost,
            cooldown = EXCLUDED.cooldown,
            target = EXCLUDED.target,
            effect = EXCLUDED.effect,
            passive_bonus = EXCLUDED.passive_bonus,
            resource_nodes = EXCLUDED.resource_nodes,
            updated_at = CURRENT_TIMESTAMP`,
          [
            skill.id,
            skill.name,
            skill.description || null,
            skill.nameKey || null,
            skill.descriptionKey || null,
            skill.type,
            skill.category || null,
            skill.maxLevel,
            skill.experienceFormula || null,
            JSON.stringify(skill.prerequisites || []),
            JSON.stringify(skill.requirements || {}),
            skill.manaCost || null,
            skill.cooldown || null,
            skill.target || null,
            JSON.stringify(skill.effect || {}),
            skill.passiveBonus ? JSON.stringify(skill.passiveBonus) : null,
            skill.resourceNodes ? JSON.stringify(skill.resourceNodes) : null,
          ]
        );
        
        await client.query('COMMIT');
        imported++;
      } catch (dbError) {
        await client.query('ROLLBACK');
        throw dbError;
      }
    } catch (error) {
      failed++;
      const skillId = error.skill?.id || file;
      console.error(`✗ Failed to import skill ${skillId}:`, error.message);
    }
  }

  console.log(`✓ Imported ${imported} skills (${failed} failed)`);
}

async function importDungeons(dataRoot) {
  const dungeonsDir = path.join(dataRoot, 'dungeons');
  if (!fs.existsSync(dungeonsDir)) {
    console.log('Dungeons directory not found, skipping...');
    return;
  }

  let imported = 0;
  let failed = 0;

  // First, try to import from combined dungeons.json file if it exists
  const combinedDungeonsPath = path.join(dungeonsDir, 'dungeons.json');
  if (fs.existsSync(combinedDungeonsPath)) {
    try {
      const dungeonsData = JSON.parse(fs.readFileSync(combinedDungeonsPath, 'utf8'));
      const dungeons = Object.values(dungeonsData.dungeons || {});
      
      console.log(`  Found combined dungeons.json with ${dungeons.length} dungeons, importing...`);
      
      for (const dungeon of dungeons) {
        try {
          await client.query('BEGIN');
          
          try {
            await client.query(
              `INSERT INTO dungeons (
                id, name, description, name_key, description_key, tier,
                required_level, required_dungeon_id, monster_pools, rewards, unlock_conditions
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                name_key = EXCLUDED.name_key,
                description_key = EXCLUDED.description_key,
                tier = EXCLUDED.tier,
                required_level = EXCLUDED.required_level,
                required_dungeon_id = EXCLUDED.required_dungeon_id,
                monster_pools = EXCLUDED.monster_pools,
                rewards = EXCLUDED.rewards,
                unlock_conditions = EXCLUDED.unlock_conditions,
                updated_at = CURRENT_TIMESTAMP`,
              [
                dungeon.id,
                dungeon.name,
                dungeon.description || null,
                dungeon.nameKey || null,
                dungeon.descriptionKey || null,
                dungeon.tier,
                dungeon.requiredLevel || null,
                dungeon.requiredDungeonId || null,
                JSON.stringify(dungeon.monsterPools || []),
                JSON.stringify(dungeon.rewards || {}),
                JSON.stringify(dungeon.unlockConditions || {}),
              ]
            );
            
            await client.query('COMMIT');
            imported++;
          } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
          }
        } catch (error) {
          failed++;
          console.error(`✗ Failed to import dungeon ${dungeon.id}:`, error.message);
        }
      }
    } catch (error) {
      console.error(`✗ Failed to read combined dungeons.json:`, error.message);
    }
  }

  // Also import from individual dungeon files (skip dungeons.json)
  const dungeonFiles = fs.readdirSync(dungeonsDir).filter((f) => f.endsWith('.json') && f !== 'dungeons.json');

  // Process dungeons individually
  for (const file of dungeonFiles) {
    try {
      // Parse JSON first
      const filePath = path.join(dungeonsDir, file);
      const dungeon = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Skip if it's a combined file structure
      if (dungeon.dungeons || dungeon.version || dungeon.total_dungeons) {
        continue;
      }

      // Use individual transaction for each dungeon
      await client.query('BEGIN');
      
      try {
        await client.query(
          `INSERT INTO dungeons (
            id, name, description, name_key, description_key, tier,
            required_level, required_dungeon_id, monster_pools, rewards, unlock_conditions
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            name_key = EXCLUDED.name_key,
            description_key = EXCLUDED.description_key,
            tier = EXCLUDED.tier,
            required_level = EXCLUDED.required_level,
            required_dungeon_id = EXCLUDED.required_dungeon_id,
            monster_pools = EXCLUDED.monster_pools,
            rewards = EXCLUDED.rewards,
            unlock_conditions = EXCLUDED.unlock_conditions,
            updated_at = CURRENT_TIMESTAMP`,
          [
            dungeon.id,
            dungeon.name,
            dungeon.description || null,
            dungeon.nameKey || null,
            dungeon.descriptionKey || null,
            dungeon.tier,
            dungeon.requiredLevel || null,
            dungeon.requiredDungeonId || null,
            JSON.stringify(dungeon.monsterPools || []),
            JSON.stringify(dungeon.rewards || {}),
            JSON.stringify(dungeon.unlockConditions || {}),
          ]
        );
        
        await client.query('COMMIT');
        imported++;
      } catch (dbError) {
        await client.query('ROLLBACK');
        throw dbError;
      }
    } catch (error) {
      failed++;
      const dungeonId = error.dungeon?.id || file;
      console.error(`✗ Failed to import dungeon ${dungeonId}:`, error.message);
    }
  }

  console.log(`✓ Imported ${imported} dungeons (${failed} failed)`);
}

async function importQuests(dataRoot) {
  const questsPath = path.join(dataRoot, 'quests/quests.json');
  if (!fs.existsSync(questsPath)) {
    console.log('Quests file not found, skipping...');
    return;
  }

  const questsData = JSON.parse(fs.readFileSync(questsPath, 'utf8'));
  const quests = Object.values(questsData.quests || {});

  // Also check for individual quest files
  const questsDir = path.join(dataRoot, 'quests');
  const questFiles = fs.readdirSync(questsDir).filter((f) => f.endsWith('.json') && f !== 'quests.json');

  for (const file of questFiles) {
    try {
      const filePath = path.join(questsDir, file);
      const quest = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!quests.find((q) => q.id === quest.id)) {
        quests.push(quest);
      }
    } catch (error) {
      console.error(`✗ Failed to read quest file ${file}:`, error.message);
    }
  }

  let imported = 0;
  let failed = 0;

  // Process quests individually
  for (const quest of quests) {
    try {
      // Use individual transaction for each quest
      await client.query('BEGIN');
      
      try {
        await client.query(
          `INSERT INTO quests (
            id, name, description, name_key, description_key, type, category,
            required_level, required_class, prerequisites, objectives, rewards
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            name_key = EXCLUDED.name_key,
            description_key = EXCLUDED.description_key,
            type = EXCLUDED.type,
            category = EXCLUDED.category,
            required_level = EXCLUDED.required_level,
            required_class = EXCLUDED.required_class,
            prerequisites = EXCLUDED.prerequisites,
            objectives = EXCLUDED.objectives,
            rewards = EXCLUDED.rewards,
            updated_at = CURRENT_TIMESTAMP`,
          [
            quest.id,
            quest.name,
            quest.description || null,
            quest.nameKey || null,
            quest.descriptionKey || null,
            quest.type || null,
            quest.category || null,
            quest.requiredLevel || null,
            quest.requiredClass || null,
            JSON.stringify(quest.prerequisites || []),
            JSON.stringify(quest.objectives || []),
            JSON.stringify(quest.rewards || {}),
          ]
        );
        
        await client.query('COMMIT');
        imported++;
      } catch (dbError) {
        await client.query('ROLLBACK');
        throw dbError;
      }
    } catch (error) {
      failed++;
      console.error(`✗ Failed to import quest ${quest.id}:`, error.message);
    }
  }

  console.log(`✓ Imported ${imported}/${quests.length} quests (${failed} failed)`);
}

importAllData();

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

async function importMonsters() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Read monsters.json file
    const monstersPath = path.join(__dirname, '../../data/monsters/monsters.json');
    const monstersData = JSON.parse(fs.readFileSync(monstersPath, 'utf8'));

    const monsters = Object.values(monstersData.monsters || {});
    console.log(`Found ${monsters.length} monsters to import`);

    await client.query('BEGIN');

    let imported = 0;
    for (const monster of monsters) {
      try {
        await client.query(
          `INSERT INTO monsters (
            id, name, description, name_key, description_key, tier, level,
            stats, abilities, loot_table, experience_reward, gold_reward
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            name_key = EXCLUDED.name_key,
            description_key = EXCLUDED.description_key,
            tier = EXCLUDED.tier,
            level = EXCLUDED.level,
            stats = EXCLUDED.stats,
            abilities = EXCLUDED.abilities,
            loot_table = EXCLUDED.loot_table,
            experience_reward = EXCLUDED.experience_reward,
            gold_reward = EXCLUDED.gold_reward,
            updated_at = CURRENT_TIMESTAMP`,
          [
            monster.id,
            monster.name,
            monster.description || null,
            monster.nameKey || null,
            monster.descriptionKey || null,
            monster.tier,
            monster.level,
            JSON.stringify(monster.stats),
            JSON.stringify(monster.abilities || []),
            JSON.stringify(monster.lootTable || []),
            monster.experienceReward,
            monster.goldReward ? JSON.stringify(monster.goldReward) : null,
          ]
        );
        imported++;
        console.log(`✓ Imported: ${monster.id}`);
      } catch (error) {
        console.error(`✗ Failed to import ${monster.id}:`, error.message);
      }
    }

    await client.query('COMMIT');
    console.log(`\nSuccessfully imported ${imported}/${monsters.length} monsters!`);

    await client.end();
  } catch (error) {
    console.error('Import failed:', error);
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
    process.exit(1);
  }
}

importMonsters();

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

async function runMigrations() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Get all migration files in order
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort alphabetically to run in order

    console.log(`Found ${files.length} migration(s) to run`);

    // Run each migration
    for (const file of files) {
      const migrationPath = path.join(migrationsDir, file);
      console.log(`Running migration: ${file}...`);
      
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await client.query(sql);
      
      console.log(`✓ Completed: ${file}`);
    }

    console.log('\nAll migrations completed successfully!');

    await client.end();
  } catch (error) {
    console.error('Migration failed:', error);
    await client.end();
    process.exit(1);
  }
}

runMigrations();

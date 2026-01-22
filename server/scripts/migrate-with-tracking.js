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

async function ensureMigrationsTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await client.query(createTableSQL);
}

async function getAppliedMigrations() {
  const result = await client.query('SELECT filename FROM schema_migrations ORDER BY filename');
  return result.rows.map(row => row.filename);
}

async function recordMigration(filename) {
  await client.query(
    'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
    [filename]
  );
}

async function runMigrations() {
  const dryRun = process.argv.includes('--dry-run');
  
  try {
    await client.connect();
    console.log('Connected to database');

    // Ensure migrations table exists
    await ensureMigrationsTable();
    console.log('Migration tracking table ready');

    // Get all migration files in order
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort alphabetically to run in order

    // Get already applied migrations
    const appliedMigrations = await getAppliedMigrations();
    console.log(`Found ${appliedMigrations.length} previously applied migration(s)`);

    // Filter out already applied migrations
    const pendingMigrations = files.filter(file => !appliedMigrations.includes(file));

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations. Database is up to date.');
      await client.end();
      return;
    }

    console.log(`Found ${pendingMigrations.length} pending migration(s) to run`);

    if (dryRun) {
      console.log('\n[DRY RUN] Would run the following migrations:');
      pendingMigrations.forEach(file => console.log(`  - ${file}`));
      await client.end();
      return;
    }

    // Run each pending migration
    for (const file of pendingMigrations) {
      const migrationPath = path.join(migrationsDir, file);
      console.log(`\nRunning migration: ${file}...`);
      
      try {
        const sql = fs.readFileSync(migrationPath, 'utf8');
        await client.query('BEGIN');
        await client.query(sql);
        await recordMigration(file);
        await client.query('COMMIT');
        
        console.log(`✓ Completed: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`✗ Failed: ${file}`);
        throw error;
      }
    }

    console.log('\n✓ All migrations completed successfully!');

    await client.end();
  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    await client.end();
    process.exit(1);
  }
}

runMigrations();

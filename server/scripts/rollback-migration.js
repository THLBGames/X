import pg from 'pg';
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

async function getLastMigration() {
  const result = await client.query(
    'SELECT filename FROM schema_migrations ORDER BY applied_at DESC, id DESC LIMIT 1'
  );
  return result.rows[0]?.filename || null;
}

async function removeMigrationRecord(filename) {
  await client.query('DELETE FROM schema_migrations WHERE filename = $1', [filename]);
}

async function rollbackMigration() {
  const migrationFile = process.argv[2];
  
  try {
    await client.connect();
    console.log('Connected to database');

    let targetMigration;
    
    if (migrationFile) {
      // Rollback specific migration
      targetMigration = migrationFile;
      console.log(`Rolling back migration: ${targetMigration}`);
    } else {
      // Rollback last migration
      targetMigration = await getLastMigration();
      if (!targetMigration) {
        console.log('No migrations to rollback.');
        await client.end();
        return;
      }
      console.log(`Rolling back last migration: ${targetMigration}`);
    }

    // Verify migration exists in tracking table
    const checkResult = await client.query(
      'SELECT filename FROM schema_migrations WHERE filename = $1',
      [targetMigration]
    );

    if (checkResult.rows.length === 0) {
      console.error(`✗ Migration ${targetMigration} not found in tracking table.`);
      await client.end();
      process.exit(1);
    }

    // Remove migration record
    // Note: This script only removes the tracking record.
    // Actual schema rollback should be handled by creating reverse migration files
    // or by manually executing rollback SQL.
    console.log('\n⚠️  WARNING: This script only removes the migration tracking record.');
    console.log('⚠️  You must manually execute rollback SQL to reverse schema changes.');
    console.log('⚠️  Consider creating reverse migration files for proper rollback support.\n');

    const confirm = process.argv.includes('--confirm');
    if (!confirm) {
      console.log('Use --confirm flag to proceed with removing the migration record.');
      await client.end();
      return;
    }

    await removeMigrationRecord(targetMigration);
    console.log(`✓ Removed migration record: ${targetMigration}`);
    console.log('\n⚠️  Remember to manually rollback the schema changes!');

    await client.end();
  } catch (error) {
    console.error('\n✗ Rollback failed:', error.message);
    await client.end();
    process.exit(1);
  }
}

rollbackMigration();

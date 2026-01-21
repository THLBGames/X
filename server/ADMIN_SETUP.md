# Admin Panel Setup Guide

This guide will walk you through setting up the admin panel for the first time.

## Step 1: Install Dependencies

First, make sure all server dependencies are installed:

```bash
cd server
npm install
```

This will install `bcrypt`, `jsonwebtoken`, and all other required packages.

## Step 2: Generate Admin Password Hash

You need to generate a bcrypt hash for the default admin password before running migrations.

### Option A: Using the provided script (Recommended)

```bash
cd server
node scripts/generate-password-hash.js admin123
```

This will output something like:
```
Password: admin123
Hash: $2b$10$abcdefghijklmnopqrstuvwxyz1234567890...
```

### Option B: Using Node.js directly

```bash
cd server
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('admin123', 10).then(hash => console.log(hash))"
```

### Option C: Use an online bcrypt generator

1. Go to https://bcrypt-generator.com/ or similar
2. Enter `admin123` as the password
3. Set rounds to 10
4. Copy the generated hash

## Step 3: Update the Migration File

1. Open `server/migrations/002_create_admin_users.sql`
2. Replace the placeholder hash in the INSERT statement:
   ```sql
   INSERT INTO admin_users (username, password_hash, email) 
   VALUES ('admin', 'PASTE_YOUR_HASH_HERE', 'admin@example.com')
   ON CONFLICT (username) DO NOTHING;
   ```

**OR** skip this step and manually create the admin user after migrations run (see Step 5).

## Step 4: Run Migrations

Make sure your PostgreSQL database is running and your `.env` file is configured correctly, then run:

```bash
cd server
npm run migrate
```

This will run all migration files in order:
- `001_create_labyrinth_tables.sql`
- `002_create_admin_users.sql`
- `003_create_monster_rewards.sql`

You should see output like:
```
Connected to database
Found 3 migration(s) to run
Running migration: 001_create_labyrinth_tables.sql...
✓ Completed: 001_create_labyrinth_tables.sql
Running migration: 002_create_admin_users.sql...
✓ Completed: 002_create_admin_users.sql
Running migration: 003_create_monster_rewards.sql...
✓ Completed: 003_create_monster_rewards.sql

All migrations completed successfully!
```

## Step 5: Create Admin User (if not done in migration)

If you didn't update the migration file with a proper hash, you can create the admin user manually:

### Option A: Using psql

```bash
psql -U postgres -d idle_rpg
```

Then run:
```sql
-- Generate a hash first using one of the methods above, then:
INSERT INTO admin_users (username, password_hash, email) 
VALUES ('admin', 'YOUR_BCRYPT_HASH_HERE', 'admin@example.com');
```

### Option B: Using the admin panel (after setting up)

Once the server is running, you can create users through the admin panel UI (if you have another admin account).

## Step 6: Set JWT Secret

Make sure your `.env` file has a strong JWT secret:

```env
JWT_SECRET=your-very-long-random-secret-key-change-this
```

You can generate a random secret with:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Step 7: Start the Server

```bash
cd server
npm run dev
```

## Step 8: Access the Admin Panel

1. Open your browser and navigate to: `http://localhost:3000/admin/login`
2. Log in with:
   - Username: `admin`
   - Password: `admin123` (or whatever password you hashed)
3. **Important**: Change the password immediately after first login through the User Management section!

## Troubleshooting

### Migration fails with "relation already exists"
This means some tables already exist. You can either:
- Drop and recreate the database: `DROP DATABASE idle_rpg; CREATE DATABASE idle_rpg;`
- Or manually check which migrations need to run

### "Cannot find module 'bcrypt'"
Make sure you ran `npm install` in the server directory.

### Login fails
- Verify the password hash matches the password you're using
- Check that the admin user was created: `SELECT * FROM admin_users;`
- Verify JWT_SECRET is set in your `.env` file

### Port already in use
Change the PORT in your `.env` file or stop the process using that port.

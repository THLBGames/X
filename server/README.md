# Labyrinth Server Setup Guide

This guide will help you set up and run the multiplayer labyrinth server for the Idle RPG game.

## Prerequisites

Before setting up the server, ensure you have the following installed:

- **Node.js** (v18 or higher recommended)
- **PostgreSQL** (v12 or higher)
- **npm** or **yarn** package manager

## Database Setup

### 1. Create PostgreSQL Database

First, create a new database for the game:

```bash
# Login to PostgreSQL
psql -U postgres

# Create the database
CREATE DATABASE idle_rpg;

# Exit PostgreSQL
\q
```

Alternatively, you can create the database from the command line:

```bash
createdb -U postgres idle_rpg
```

### 2. Set Up Environment Variables

Create a `.env` file in the `server` directory with the following variables:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=idle_rpg
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# Server Configuration
PORT=3001
CLIENT_URL=http://localhost:3000

# JWT Secret for Admin Authentication (generate a strong random string)
JWT_SECRET=your-secret-key-change-this-in-production

# Optional: Custom database settings
# DB_MAX_CONNECTIONS=20
# DB_IDLE_TIMEOUT=30000
# DB_CONNECTION_TIMEOUT=2000
```

**Important:** Replace `your_postgres_password` with your actual PostgreSQL password.

### 3. Run Database Migrations

Run the migration script to create all necessary tables:

```bash
npm run migrate
```

Or directly using Node:

```bash
node scripts/migrate.js
```

**For tracked migrations (recommended):**

```bash
npm run migrate:tracked
```

This will create all the required tables:
- `labyrinths` - Labyrinth definitions and state
- `labyrinth_floors` - Floor definitions per labyrinth
- `labyrinth_participants` - Player participation tracking
- `labyrinth_parties` - Party formation
- `labyrinth_events` - Event log for debugging/auditing
- `labyrinth_combat_instances` - Active combat sessions
- `labyrinth_rewards` - Rewards earned by players
- `admin_users` - Admin user accounts
- `global_monster_rewards` - Global monster reward configuration
- `floor_monster_rewards` - Floor-specific monster reward overrides
- `schema_migrations` - Migration tracking table

## Installation

### 1. Install Dependencies

From the `server` directory:

```bash
npm install
```

This will install all required packages including:
- `express` - Web server framework
- `socket.io` - Real-time communication
- `pg` - PostgreSQL client
- `uuid` - UUID generation
- `dotenv` - Environment variable management

### 2. Build Shared Package

The server depends on the shared package. Make sure it's built first:

```bash
# From the project root
cd shared
npm install
npm run build
cd ../server
```

## Running the Server

### Development Mode

To run the server in development mode with auto-reload:

```bash
npm run dev
```

This uses `tsx watch` to automatically restart the server when files change.

### Production Mode

1. Build the TypeScript code:

```bash
npm run build
```

2. Start the server:

```bash
npm start
```

### Manual Testing

Once the server is running, you can test it:

1. **Health Check:**
   ```bash
   curl http://localhost:3001/health
   ```

2. **Database Health Check:**
   ```bash
   curl http://localhost:3001/health/db
   ```

3. **List Available Labyrinths:**
   ```bash
   curl http://localhost:3001/api/labyrinth/list
   ```

## Server Features

### HTTP Endpoints

- `GET /health` - Server health check
- `GET /health/db` - Database connection health check
- `GET /api/labyrinth/list` - List all available labyrinths
- `GET /api/labyrinth/:id` - Get labyrinth details
- `GET /api/labyrinth/:id/participant/:character_id` - Get participant info
- `GET /api/labyrinth/:id/floor/:floor_number/players` - Get players on a floor
- `GET /api/labyrinth/rewards/:character_id` - Get unclaimed rewards
- `POST /api/labyrinth/create` - Create a new labyrinth (admin)

### WebSocket Events

The server supports real-time communication via Socket.IO:

**Client → Server:**
- `labyrinth:join` - Join a labyrinth
- `labyrinth:create_party` - Create a party
- `labyrinth:join_party` - Join existing party
- `labyrinth:leave_party` - Leave party
- `labyrinth:move` - Player movement
- `labyrinth:initiate_combat` - Start combat
- `labyrinth:combat_action` - Combat turn action
- `labyrinth:claim_rewards` - Claim earned rewards

**Server → Client:**
- `labyrinth:joined` - Confirmation of join
- `labyrinth:player_joined` - New player in floor
- `labyrinth:player_left` - Player left/died
- `labyrinth:floor_changed` - Floor transition
- `labyrinth:player_discovered` - Nearby player found
- `labyrinth:combat_initiated` - Combat started
- `labyrinth:combat_update` - Combat state update
- `labyrinth:eliminated` - Player eliminated
- `labyrinth:completed` - Labyrinth finished
- `labyrinth:reward_earned` - New reward available

## Configuration

### Database Connection Pool

The server uses a connection pool with the following default settings:
- Maximum connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

These can be adjusted by modifying `server/src/config/database.ts`.

### CORS Configuration

The server allows connections from:
- `http://localhost:3000` (default)
- Or the URL specified in `CLIENT_URL` environment variable

To allow additional origins, modify the CORS configuration in `server/src/server.ts`.

## Troubleshooting

### Database Connection Issues

If you're having trouble connecting to the database:

1. Verify PostgreSQL is running:
   ```bash
   # On Linux/Mac
   sudo systemctl status postgresql
   
   # On Windows
   # Check Services panel or Task Manager
   ```

2. Verify database credentials in `.env` file

3. Test connection manually:
   ```bash
   psql -U postgres -d idle_rpg -h localhost
   ```

### Port Already in Use

If port 3001 is already in use:

1. Change the `PORT` in your `.env` file
2. Update the `CLIENT_URL` in the client's environment variables accordingly

### Migration Errors

If migrations fail:

1. Ensure the database exists and is accessible
2. Check that you have the correct permissions
3. Verify the `.env` file has correct database credentials
4. Try dropping and recreating the database if needed

## Development

### Project Structure

```
server/
├── src/
│   ├── config/          # Configuration files (database, etc.)
│   ├── models/          # Database models
│   ├── services/        # Business logic services
│   ├── sockets/         # Socket.IO event handlers
│   ├── routes/          # HTTP API routes
│   └── server.ts        # Main server file
├── migrations/          # Database migration scripts
├── scripts/             # Utility scripts
├── package.json
└── tsconfig.json
```

### Adding New Features

1. **Database Changes:** Create a new migration file in `migrations/`
2. **Models:** Add new model files in `src/models/`
3. **Services:** Add business logic in `src/services/`
4. **Routes:** Add HTTP endpoints in `src/routes/`
5. **Socket Events:** Add real-time handlers in `src/sockets/`

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production` in your environment
2. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start dist/server.js --name labyrinth-server
   ```

3. Set up a reverse proxy (nginx/Apache) for SSL termination
4. Configure firewall rules to expose the necessary ports
5. Set up database backups and monitoring

## Running Migrations in Render

### Method 1: Render Shell (Recommended for Manual Runs)

1. Go to your Render service dashboard
2. Click **"Shell"** button (top right)
3. Run the migration:
   ```bash
   cd server
   npm run migrate:tracked
   ```

The environment variables are automatically available in the shell, so no additional configuration is needed.

### Method 2: GitHub Actions (Automated)

Migrations run automatically after deployment via GitHub Actions workflows. Make sure you have the following GitHub Secrets configured:

**For Staging:**
- `RENDER_DB_HOST_STAGING`
- `RENDER_DB_PORT_STAGING`
- `RENDER_DB_NAME_STAGING`
- `RENDER_DB_USER_STAGING`
- `RENDER_DB_PASSWORD_STAGING`

**For Production:**
- `RENDER_DB_HOST_PRODUCTION`
- `RENDER_DB_PORT_PRODUCTION`
- `RENDER_DB_NAME_PRODUCTION`
- `RENDER_DB_USER_PRODUCTION`
- `RENDER_DB_PASSWORD_PRODUCTION`

### Method 3: Using Render Database Connection String

If you have the database connection string, you can also run migrations locally:

```bash
# Set environment variables from Render database connection string
export DB_HOST=your-db-host
export DB_PORT=5432
export DB_NAME=idle_rpg_staging
export DB_USER=your-db-user
export DB_PASSWORD=your-db-password

# Run migration
cd server
npm run migrate:tracked
```

### Migration Commands

- `npm run migrate` - Run all migrations (legacy, runs all migrations)
- `npm run migrate:tracked` - Run pending migrations with tracking (recommended)
- `npm run migrate:dry-run` - Preview pending migrations without executing
- `npm run migrate:rollback` - Rollback last migration (requires `--confirm` flag)

## Admin Panel

The server includes a comprehensive admin panel accessible at `/admin` route in the client application.

### Admin Authentication

1. **Default Admin Account**
   - After running migrations, a default admin user is created:
     - Username: `admin`
     - Password: `admin123` (must be changed!)
   - **Important**: The password hash in the migration is a placeholder. You should:
     - Generate a proper bcrypt hash for `admin123` before running migrations, OR
     - Change the password immediately after first login through the admin panel

2. **Accessing the Admin Panel**
   - Navigate to `http://localhost:3000/admin/login` (or your client URL)
   - Log in with admin credentials
   - Access the dashboard for managing labyrinths, monster rewards, achievements, and rules

3. **Admin Features**
   - **Labyrinth Management**: Create, edit, delete, start, and cancel labyrinths
   - **Monster Rewards**: Configure global and floor-specific monster rewards
   - **Achievements**: Manage labyrinth achievements
   - **Rules Configuration**: Set global labyrinth rules and defaults
   - **User Management**: Create and manage admin user accounts

### Creating Additional Admin Users

1. Log in to the admin panel
2. Navigate to the "Users" section
3. Click "Create New User"
4. Enter username, password, and optional email
5. The new user will be able to access the admin panel

### Security Notes

- Change the default admin password immediately
- Use a strong `JWT_SECRET` in your `.env` file
- Regularly review admin user accounts and remove unused ones
- Admin actions are authenticated via JWT tokens stored in localStorage

## CI/CD Pipeline

The project includes automated CI/CD pipelines using GitHub Actions and Render for deployment.

### Overview

- **CI Workflow**: Runs on every push/PR to validate code quality and build
- **Staging Deployment**: Automatically deploys to staging on merge to `main` or `develop`
- **Production Deployment**: Deploys to production on release publication

### Setup

#### 1. Render Configuration

The project uses Render for hosting. Infrastructure is defined in `render.yaml` at the project root.

**Services:**
- `idle-rpg-server-staging` - Staging web service
- `idle-rpg-server-production` - Production web service

**Databases:**
- `idle-rpg-db-staging` - Staging PostgreSQL database
- `idle-rpg-db-production` - Production PostgreSQL database

To set up Render services:
1. Connect your GitHub repository to Render
2. Import the `render.yaml` blueprint
3. Render will create the services and databases automatically

#### 2. GitHub Secrets

Configure the following secrets in your GitHub repository settings:

**Required Secrets:**
- `RENDER_API_KEY` - Render API key (found in Render dashboard)
- `RENDER_SERVICE_ID_STAGING` - Staging service ID from Render
- `RENDER_SERVICE_ID_PRODUCTION` - Production service ID from Render
- `RENDER_SERVICE_URL_STAGING` - Staging service URL (e.g., `https://idle-rpg-server-staging.onrender.com`)
- `RENDER_SERVICE_URL_PRODUCTION` - Production service URL

**Database Secrets (for migrations):**
- `RENDER_DB_HOST_STAGING` - Staging database host
- `RENDER_DB_PORT_STAGING` - Staging database port (usually 5432)
- `RENDER_DB_NAME_STAGING` - Staging database name
- `RENDER_DB_USER_STAGING` - Staging database user
- `RENDER_DB_PASSWORD_STAGING` - Staging database password
- `RENDER_DB_HOST_PRODUCTION` - Production database host
- `RENDER_DB_PORT_PRODUCTION` - Production database port
- `RENDER_DB_NAME_PRODUCTION` - Production database name
- `RENDER_DB_USER_PRODUCTION` - Production database user
- `RENDER_DB_PASSWORD_PRODUCTION` - Production database password

#### 3. Environment Variables in Render

Set the following environment variables in the Render dashboard for each service:

- `NODE_ENV` - `staging` or `production`
- `PORT` - `3001`
- `CLIENT_URL` - Your client application URL
- `JWT_SECRET` - Strong random string for JWT signing

Database connection variables are automatically set by Render when using the blueprint.

### Migration System

The project uses a tracked migration system that prevents running migrations multiple times.

#### Migration Scripts

- `npm run migrate` - Run all migrations (legacy, runs all migrations)
- `npm run migrate:tracked` - Run pending migrations with tracking (recommended)
- `npm run migrate:dry-run` - Preview pending migrations without executing
- `npm run migrate:rollback` - Rollback last migration (requires `--confirm` flag)

#### Migration Tracking

Migrations are tracked in the `schema_migrations` table:
- Only pending migrations are executed
- Each migration is recorded with timestamp
- Safe to run multiple times (idempotent)

#### Running Migrations Manually

For local development:
```bash
cd server
npm run migrate:tracked
```

For staging/production (via CI/CD):
Migrations run automatically after deployment in the GitHub Actions workflows.

### Deployment Flow

#### Staging Deployment

1. Push to `main` or `develop` branch
2. CI workflow validates code
3. Staging deployment workflow:
   - Builds server and shared packages
   - Deploys to Render staging service
   - Runs database migrations on staging database
   - Verifies health checks

#### Production Deployment

1. Create a GitHub release
2. Production deployment workflow:
   - Builds server and shared packages
   - Deploys to Render production service
   - Runs database migrations on production database
   - Verifies health checks
   - Rolls back on failure

**Manual Production Deployment:**
You can also trigger production deployment manually via GitHub Actions:
1. Go to Actions → Deploy to Production
2. Click "Run workflow"
3. Type "deploy" to confirm

### Health Checks

The deployment pipelines verify service health:

- `GET /health` - Basic server health check
- `GET /health/db` - Database connection health check

Both endpoints must return 200 OK for deployment to succeed.

### Rollback

If a production deployment fails health checks:
- The workflow automatically attempts to rollback the Render service
- Database migrations are idempotent and safe to re-run
- Manual rollback can be performed via Render dashboard

### Troubleshooting CI/CD

**Deployment fails:**
1. Check GitHub Actions logs for error details
2. Verify all required secrets are set
3. Ensure Render services are running
4. Check database connectivity

**Migrations fail:**
1. Verify database credentials in GitHub Secrets
2. Check migration SQL syntax
3. Ensure database user has necessary permissions
4. Review migration tracking table state

**Health checks fail:**
1. Verify service is running in Render dashboard
2. Check service logs in Render
3. Verify environment variables are set correctly
4. Check database connection health

## Support

For issues or questions, please refer to the main project documentation or create an issue in the repository.

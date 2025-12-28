# Idle RPG Game

A data-driven idle RPG game built with React, TypeScript, and Electron. Features class-based characters, dungeon combat zones, hundreds of monsters, thousands of items, and 20+ skills with offline progress support.

## Project Structure

- `client/` - React frontend application
- `server/` - Node.js backend (optional, for cloud saves)
- `shared/` - Shared TypeScript types and utilities
- `data/` - Game data files (JSON configuration)
- `electron/` - Electron wrapper for Steam release

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: IndexedDB (client-side) + SQLite/PostgreSQL (cloud saves)
- **Desktop**: Electron

## Development

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Setup

```bash
# Install dependencies
npm install

# Copy data files to client public directory
npm run copy-data
```

### Run Development Server

```bash
npm run dev
```

This will start the Vite dev server at http://localhost:3000

### Build

```bash
# Build for production
npm run build
```

This will:
1. Build the shared package
2. Copy data files to client/public
3. Build the React client application

### Build Electron App

```bash
cd electron
npm install
npm run build
```

## License

Private project


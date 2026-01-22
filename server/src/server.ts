import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { pool } from './config/database.js';
import { setupLabyrinthRoutes } from './routes/labyrinth.js';
import { setupLabyrinthSocket } from './sockets/LabyrinthSocket.js';
import { setupAuthRoutes } from './routes/auth.js';
import { setupAdminRoutes } from './routes/admin.js';
import { FloorTimeLimitService } from './services/FloorTimeLimitService.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database health check
app.get('/health/db', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: (error as Error).message });
  }
});

// Cloud save endpoints (placeholder)
app.post('/api/saves', async (req, res) => {
  // TODO: Implement cloud save storage
  res.json({ success: true, message: 'Cloud save endpoint - not yet implemented' });
});

app.get('/api/saves/:userId', async (req, res) => {
  // TODO: Implement cloud save retrieval
  res.json({ success: true, message: 'Cloud save retrieval - not yet implemented' });
});

// Steam integration endpoints (placeholder)
app.post('/api/steam/achievement', async (req, res) => {
  // TODO: Implement Steam achievement tracking
  res.json({ success: true, message: 'Steam achievement - not yet implemented' });
});

// Auth routes (must be before admin routes)
setupAuthRoutes(app);

// Admin routes (protected)
setupAdminRoutes(app);

// Labyrinth routes
setupLabyrinthRoutes(app, io);

// Socket.IO setup
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  setupLabyrinthSocket(io, socket);
});

// Start time limit checking service
import { FloorTimeLimitService } from './services/FloorTimeLimitService.js';

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO server ready for connections`);
  // Start time limit checking service (check every hour)
  FloorTimeLimitService.startPeriodicCheck(io, 60);
  console.log(`Floor time limit service started (checking every 60 minutes)`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});
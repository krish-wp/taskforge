import { Server } from 'socket.io';
import pool from '../config/db.js';

let io = null;
let connectedClients = 0;
let lastPollTime = new Date();

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    connectedClients++;
    console.log(`Client connected (${connectedClients} total)`);

    socket.emit('init', {
      lastPoll: lastPollTime.toISOString(),
    });

    socket.on('disconnect', () => {
      connectedClients--;
      console.log(`Client disconnected (${connectedClients} total)`);
    });
  });

  // Start polling
  setInterval(pollDatabase, 2000);

  return io;
};

const pollDatabase = async () => {
  if (connectedClients === 0 || !io) return;

  try {
    const { rows } = await pool.query(
      `
      SELECT 
        id, type, status, priority, attempts, max_attempts,
        created_at, started_at, completed_at, queued_at, updated_at, error
      FROM jobs
      WHERE updated_at > $1
      ORDER BY updated_at DESC
    `,
      [lastPollTime],
    );

    if (rows.length > 0) {
      io.emit('jobs:update', rows);
      lastPollTime = new Date();
    }
  } catch (err) {
    console.error('Poll error:', err.message);
  }
};

export const getIO = () => io;

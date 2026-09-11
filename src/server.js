import express from 'express';
import pool from './config/db.js';
import redisClient from './config/redis.js';
import { connectRedis } from './config/redis.js';
import { fork } from 'child_process';
import { initSocket } from './realtime/socket.js';
import { createServer } from 'http';

const app = express();
const httpServer = createServer(app);
initSocket(httpServer);

const port = process.env.PORT || 3000;

const initServer = async () => {
  // Connect Redis FIRST
  await connectRedis('server');

  redisClient
    .ping()
    .then(() => console.log('-->[Redis] Ping successful'))
    .catch((err) => console.error('-->[Redis] Ping failed:', err.message));

  // Then DB check
  await pool
    .query('SELECT NOW()')
    .then(() => console.log('-->[DB] Database connected'))
    .catch((err) => console.error('-->[DB] Connection failed:', err.message));

  // Then start server
  httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
};

// Start everything
initServer();

import jobsRouter from './routes/jobs.routes.js';
import dashBoardRouter from './routes/dashboard.routes.js';

app.use(express.json());

app.use('/api/v1/jobs', jobsRouter);
app.use('/api/v1/dashboard', dashBoardRouter);

// Start recovery worker as a separate Node.js process
const startRecoveryWorker = () => {
  const recoveryWorker = fork('./src/worker/recovery_worker.js');

  recoveryWorker.on('error', (error) => {
    console.error('-->[Recovery] Recovery worker error:', error);
  });

  recoveryWorker.on('exit', (code) => {
    console.log(
      `-->[Recovery] Recovery worker stopped with code ${code}; restarting...`,
    );
    startRecoveryWorker();
  });
};

const startExecutionWorker = (id) => {
  const executionWorker = fork('./src/worker/execution_worker.js', [], {
    env: { ...process.env, WORKER_ID: id },
  });

  executionWorker.on('error', (error) => {
    console.error('-->[Execution] Execution worker error:', error);
  });

  executionWorker.on('exit', (code) => {
    console.log(
      `-->[Execution] Execution worker stopped with code ${code}; restarting...`,
    );
    startExecutionWorker(id);
  });
};

startRecoveryWorker();

const WORKER_COUNT = Number(process.env.EXECUTION_WORKERS) || 2;
for (let i = 0; i < WORKER_COUNT; i++) {
  startExecutionWorker(i);
}

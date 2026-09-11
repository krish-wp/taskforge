import pool from '../config/db.js';

import { connectRedis } from '../config/redis.js';
import redisClient from '../config/redis.js';

import workerLog from '../loging/logger.js';

const WORKER_ID = process.env.WORKER_ID || 'unknown';
await connectRedis(WORKER_ID);

//add workerlog at each console.log and console.error to log the output to a file for each worker

async function executionWorker() {
  const result = await redisClient.BLPOP('taskforge:jobs', 5);
  if (!result) return;
  const jobid = result.element;

  let currentAttempt = 0;
  let jobData;

  try {
    jobData = await pool.query('SELECT * FROM jobs WHERE id = $1', [jobid]);

    if (jobData.rows.length === 0) {
      workerLog(
        'execution',
        WORKER_ID,
        `Job ${jobid} not found in database, skipping`,
      );
      return;
    }

    await pool.query(
      'UPDATE jobs SET status = $1, attempts = attempts + 1, updated_at = NOW(), started_at = NOW() WHERE id = $2',
      ['RUNNING', jobid],
    );

    currentAttempt = jobData.rows[0].attempts + 1;
  } catch (error) {
    workerLog(
      'execution',
      WORKER_ID,
      `Error fetching job ${jobid} from database: ${error.message}`,
    );
    return;
  }

  try {
    await new Promise((resolve, reject) => {
      const delay = Math.floor(Math.random() * 5000) + 1000;

      setTimeout(() => {
        const success = Math.random() < 0.7; // 70% success

        if (success) {
          resolve();
        } else {
          reject(new Error('Simulated job failure'));
        }
      }, delay);
    });

    await pool.query(
      'UPDATE jobs SET status = $1, updated_at = NOW(), completed_at = NOW() WHERE id = $2',
      ['COMPLETED', jobid],
    );

    workerLog(
      'execution',
      WORKER_ID,
      `Job ${jobid} completed successfully on attempt ${currentAttempt}`,
    );
  } catch (error) {
    workerLog(
      'execution',
      WORKER_ID,
      `Job ${jobid} failed on attempt ${currentAttempt}: ${error.message}`,
    );
    if (currentAttempt < jobData.rows[0].max_attempts) {
      try {
        await pool.query(
          'UPDATE jobs SET status = $1, queued_at = NULL, updated_at = NOW() WHERE id = $2',
          ['RETRYING', jobid],
        );

        //add to the queue for retry
        await redisClient.LPUSH('taskforge:jobs', jobid);
      } catch (err) {
        workerLog(
          'execution',
          WORKER_ID,
          `Error updating job ${jobid} for retry: ${err.message}`,
        );
      }
      workerLog(
        'execution',
        WORKER_ID,
        `Job ${jobid} failed on attempt ${currentAttempt}, will retry`,
      );
      //make sure to push the job back to the queue for retry
      //for that we can make queue_at to null then recover thing will push it back to the queue
    } else {
      try {
        await pool.query(
          'UPDATE jobs SET status = $1, error = $2, updated_at = NOW() WHERE id = $3',
          ['FAILED', error.message, jobid],
        );
      } catch (err) {
        workerLog(
          'execution',
          WORKER_ID,
          `Error updating job ${jobid} to FAILED: ${err.message}`,
        );
      }
    }
  }
}

//for better ending redis and postgre connections at the end
let running = true;

const stop = () => {
  running = false;
};

process.on('SIGTERM', stop);
process.on('SIGINT', stop);

async function run() {
  while (running) {
    try {
      await executionWorker();
    } catch (error) {
      workerLog('execution', WORKER_ID, `Error: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Graceful shutdown cleanup
  try {
    await redisClient.quit();
    workerLog('execution', WORKER_ID, `Redis connection closed`);
  } catch (err) {
    workerLog('execution', WORKER_ID, `Error closing Redis: ${err.message}`);
  }

  try {
    await pool.end();
    workerLog('execution', WORKER_ID, `DB pool closed`);
  } catch (err) {
    workerLog('execution', WORKER_ID, `Error closing DB pool: ${err.message}`);
  }

  workerLog('execution', WORKER_ID, `Exiting gracefully`);
  process.exit(0);
}

run();

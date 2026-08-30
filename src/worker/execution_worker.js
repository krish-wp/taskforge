import pool from '../config/db.js';

import { connectRedis } from '../config/redis.js';
import redisClient from '../config/redis.js';

await connectRedis();

async function executionWorker() {
  const result = await redisClient.BLPOP('taskforge:jobs', 0);

  const jobid = result.element;

  const jobData = await pool.query('SELECT * FROM jobs WHERE id = $1', [jobid]);

  if (jobData.rows.length === 0) {
    console.warn(`-->[Worker] Job ${jobid} not found in database, skipping`);
    return;
  }

  await pool.query(
    'UPDATE jobs SET status = $1, attempts = attempts + 1, updated_at = NOW(), started_at = NOW() WHERE id = $2',
    ['RUNNING', jobid],
  );

  const currentAttempt = jobData.rows[0].attempts + 1;

  try {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    await pool.query(
      'UPDATE jobs SET status = $1, updated_at = NOW(), completed_at = NOW() WHERE id = $2',
      ['COMPLETED', jobid],
    );
  } catch (error) {
    if (currentAttempt < jobData.rows[0].max_attempts) {
      await pool.query(
        'UPDATE jobs SET status = $1, queued_at = NULL, updated_at = NOW() WHERE id = $2',
        ['RETRYING', jobid],
      );

      //add to the queue for retry
      await redisClient.LPUSH('taskforge:jobs', jobid);

      //make sure to push the job back to the queue for retry
      //for that we can make queue_at to null then recover thing will push it back to the queue
    } else {
      await pool.query(
        'UPDATE jobs SET status = $1, error = $2, updated_at = NOW() WHERE id = $3',
        ['FAILED', error.message, jobid],
      );
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
      console.error('-->[Worker] Error:', error.message);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Graceful shutdown cleanup
  try {
    await redisClient.quit();
    console.log('-->[Worker] Redis connection closed');
  } catch (err) {
    console.error('-->[Worker] Error closing Redis:', err.message);
  }

  try {
    await pool.end();
    console.log('-->[Worker] DB pool closed');
  } catch (err) {
    console.error('-->[Worker] Error closing DB pool:', err.message);
  }

  console.log('-->[Worker] Exiting gracefully');
  process.exit(0);
}

run();

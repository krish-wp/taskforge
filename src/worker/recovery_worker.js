import pool from '../config/db.js';
import { enqueueJob } from '../queue/queue.js';
import redisClient, { isRedisReady, connectRedis } from '../config/redis.js';

async function recoverJobs() {
  await connectRedis();

  // Don't query jobs if Redis is unavailable
  if (!isRedisReady()) {
    return;
  }

  console.log('-->[Recovery] Checking for jobs to recover...');

  const staleResult = await pool.query(
    `UPDATE jobs 
  SET status = $2, 
  queued_at = NULL, 
  started_at = NULL, 
  worker_id = NULL,
  updated_at = NOW()
  WHERE status = $1 
  AND updated_at < NOW() - INTERVAL '5 minutes'`,
    ['RUNNING', 'PENDING'],
  );

  if (staleResult.rowCount > 0) {
    console.log(
      `-->[Recovery] Reset ${staleResult.rowCount} stuck RUNNING jobs to PENDING`,
    );
  }

  const result = await pool.query(`
        SELECT id
        FROM jobs
        WHERE status = 'PENDING'
          AND queued_at IS NULL
        ORDER BY created_at ASC
        LIMIT 100
    `);

  for (const job of result.rows) {
    try {
      // First put the job into Redis
      await enqueueJob(job.id);

      // Only mark queued after Redis succeeds
      await pool.query(
        `
                UPDATE jobs
                SET queued_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
                  AND queued_at IS NULL
            `,
        [job.id],
      );
    } catch (error) {
      continue;
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
      await recoverJobs();
    } catch (error) {
      console.error('-->[Recovery] Error:', error.message);
    }
    await new Promise((resolve) => setTimeout(resolve, 6000));
  }

  // Graceful shutdown cleanup
  try {
    await redisClient.quit();
    console.log('-->[Recovery] Redis connection closed');
  } catch (err) {
    console.error('-->[Recovery] Error closing Redis:', err.message);
  }

  try {
    await pool.end();
    console.log('-->[Recovery] DB pool closed');
  } catch (err) {
    console.error('-->[Recovery] Error closing DB pool:', err.message);
  }

  console.log('-->[Recovery] Exiting gracefully');
  process.exit(0);
}

run();

import pool from '../config/db.js';
import { enqueueJob } from '../queue/queue.js';
import { isRedisReady } from '../config/redis.js';

export const getAllJobs = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM jobs ORDER BY created_at DESC',
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createJob = async (req, res) => {
  try {
    const { type, payload, priority, max_attempts } = req.body;

    //CHECK FOR NULL VALUES
    if (!type || !payload) {
      return res.status(400).json({ error: 'Type and payload are required' });
    }

    const result = await pool.query(
      'INSERT INTO jobs (type, payload, priority, max_attempts) VALUES ($1, $2, $3, $4) RETURNING *',
      [type, payload, priority ?? 'MEDIUM', max_attempts ?? 3],
    );

    const job = result.rows[0];

    if (isRedisReady()) {
      await enqueueJob(job.id);

      await pool.query(
        `UPDATE jobs
        SET queued_at = NOW(),
         updated_at = NOW()
        WHERE id = $1`,
        [job.id],
      );
    }

    await res.status(201).json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getJobById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, payload, priority, max_attempts, worker_id, error } =
      req.body;
    const result = await pool.query(
      `UPDATE jobs 
   SET type = COALESCE($1, type), 
       payload = COALESCE($2, payload), 
       priority = COALESCE($3, priority), 
       max_attempts = COALESCE($4, max_attempts), 
       worker_id = COALESCE($5, worker_id), 
       error = COALESCE($6, error),
       updated_at = NOW()
   WHERE id = $7 RETURNING *`,
      [type, payload, priority, max_attempts, worker_id, error, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

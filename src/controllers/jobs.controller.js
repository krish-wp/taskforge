import pool from '../config/db.js';
import { enqueueJob } from '../queue/queue.js';
import { isRedisReady } from '../config/redis.js';

export const getAllJobs = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const status = req.query.status || null;

    let countQuery = 'SELECT COUNT(*) as total FROM jobs';
    let dataQuery = 'SELECT * FROM jobs';
    const params = [];
    const countParams = [];

    if (status) {
      countQuery += ' WHERE status = $1';
      dataQuery += ' WHERE status = $1';
      params.push(status);
      countParams.push(status);
    }

    dataQuery += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    const result = await pool.query(dataQuery, params);

    res.json({
      jobs: result.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
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

    res.status(201).json(job);
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

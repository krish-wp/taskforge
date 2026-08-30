import pool from '../config/db.js';

export const getStats = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM jobs
      GROUP BY status
    `);

    const stats = {
      PENDING: 0,
      RUNNING: 0,
      COMPLETED: 0,
      FAILED: 0,
      RETRYING: 0,
      CANCELLED: 0,
      DEAD: 0,
    };

    rows.forEach((row) => {
      stats[row.status] = parseInt(row.count);
    });

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getMetrics = async (req, res) => {
  try {
    const { rows: totalRow } = await pool.query(
      `SELECT COUNT(*) as total FROM jobs`,
    );

    const total = parseInt(totalRow[0].total);

    const { rows: completedRow } = await pool.query(`
      SELECT 
        COUNT(*) as completed,
        COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))), 0) as avg_duration
      FROM jobs
      WHERE status = 'COMPLETED' AND started_at IS NOT NULL AND completed_at IS NOT NULL
    `);

    const { rows: failedRow } = await pool.query(
      `SELECT COUNT(*) as failed FROM jobs WHERE status = 'FAILED'`,
    );

    const { rows: recentRow } = await pool.query(`
      SELECT COUNT(*) as recent_completed
      FROM jobs
      WHERE status = 'COMPLETED' AND completed_at > NOW() - INTERVAL '1 minute'
    `);

    res.json({
      total,
      completed: parseInt(completedRow[0].completed),
      failed: parseInt(failedRow[0].failed),
      avgDuration: parseFloat(completedRow[0].avg_duration) || 0,
      throughputPerMinute: parseInt(recentRow[0].recent_completed),
      failureRate:
        total > 0
          ? ((parseInt(failedRow[0].failed) / total) * 100).toFixed(2)
          : '0.00',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getRecentJobs = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        id, type, status, priority, attempts, max_attempts,
        created_at, started_at, completed_at, queued_at, updated_at, error
      FROM jobs
      ORDER BY updated_at DESC
      LIMIT 50
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

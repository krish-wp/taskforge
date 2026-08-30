import pg from 'pg';

const pool = new pg.Pool({
  user: process.env.DB_USER || 'taskforge',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'taskforge',
  password: process.env.DB_PASSWORD || 'taskforge',
  port: process.env.DB_PORT || 5432,
});

try {
  await pool.connect();
  console.log('Connected to PostgreSQL');
} catch (err) {
  console.error('Error connecting to PostgreSQL:', err);
  process.exit(1);
}

export default pool;

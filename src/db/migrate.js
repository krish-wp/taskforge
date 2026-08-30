import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigrations = async () => {
  const migrationsDir = path.join(__dirname, '../../migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Running: ${file}`);
    await pool.query(sql);
    console.log(`Completed: ${file}`);
  }

  console.log('All migrations completed');
  process.exit(0);
};

runMigrations().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

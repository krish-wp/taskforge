// JavaScript
// monitor.js

import pool from '../config/db.js';
import { connectRedis, isRedisReady } from '../config/redis.js';

await connectRedis();

// Store previous values to calculate throughput
let previousCompleted = 0;
let previousTime = Date.now();

async function getStats() {
  // Get overall job statistics
  const overallResult = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed,
      COUNT(*) FILTER (WHERE status = 'RUNNING') AS running,
      COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
      COUNT(*) FILTER (WHERE status = 'FAILED') AS failed,
      COUNT(*) FILTER (WHERE status = 'RETRYING') AS retrying,
      COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled,
      COUNT(*) FILTER (WHERE status = 'DEAD') AS dead
    FROM jobs
  `);

  // Get statistics by job type
  const typeResult = await pool.query(`
    SELECT
      type,
      COUNT(*) AS total,
      COUNT(*) FILTER (
        WHERE status = 'COMPLETED'
      ) AS completed
    FROM jobs
    GROUP BY type
    ORDER BY COUNT(*) DESC
  `);

  // Get latest jobs
  const recentResult = await pool.query(`
    SELECT
      id,
      type,
      status
    FROM jobs
    ORDER BY id DESC
    LIMIT 5
  `);

  return {
    overall: overallResult.rows[0],
    types: typeResult.rows,
    recent: recentResult.rows,
  };
}

function createBar(completed, total, width = 25) {
  if (total === 0) {
    return '░'.repeat(width);
  }

  const percentage = completed / total;

  const filled = Math.round(percentage * width);

  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function calculateThroughput(completed) {
  const now = Date.now();

  const elapsedSeconds = (now - previousTime) / 1000;

  const completedNow = Number(completed);

  let rate = 0;

  if (elapsedSeconds > 0) {
    rate = (completedNow - previousCompleted) / elapsedSeconds;
  }

  previousCompleted = completedNow;
  previousTime = now;

  return Math.max(0, rate);
}

function statusIcon(status) {
  const icons = {
    COMPLETED: '✓',
    RUNNING: '⚙',
    PENDING: '○',
    RETRYING: '↻',
    FAILED: '✗',
    CANCELLED: '⊘',
    DEAD: '☠',
  };

  return icons[status] || '?';
}

function display(stats) {
  const { overall, types, recent } = stats;

  const total = Number(overall.total);
  const completed = Number(overall.completed);
  const running = Number(overall.running);
  const pending = Number(overall.pending);
  const retrying = Number(overall.retrying);
  const failed = Number(overall.failed);
  const cancelled = Number(overall.cancelled);
  const dead = Number(overall.dead);

  // Overall completion percentage
  const percentage = total === 0 ? 0 : ((completed / total) * 100).toFixed(1);

  // Jobs processed per second
  const throughput = calculateThroughput(completed);

  // Clear terminal
  process.stdout.write('\x1b[H\x1b[J');

  let output = '';

  // Header
  output += '╔════════════════════════════════════════════╗\n';

  output += '║            TASKFORGE MONITOR              ║\n';

  output += '╚════════════════════════════════════════════╝\n\n';

  // SYSTEM
  output += 'SYSTEM\n';
  output += '────────────────────────────────────────────\n';

  output += `PostgreSQL     ● CONNECTED\n`;

  output += `Redis          ${
    isRedisReady() ? '● CONNECTED' : '✗ DISCONNECTED'
  }\n`;

  output += `Worker         ● RUNNING\n\n`;

  // JOBS
  output += 'JOBS\n';
  output += '────────────────────────────────────────────\n';

  output += `Total          ${total}\n`;
  output += `Completed      ${completed}\n`;
  output += `Running        ${running}\n`;
  output += `Pending        ${pending}\n`;
  output += `Retrying       ${retrying}\n`;
  output += `Failed         ${failed}\n`;
  output += `Cancelled      ${cancelled}\n`;
  output += `Dead           ${dead}\n\n`;

  // PROGRESS
  output += 'PROGRESS\n';
  output += '────────────────────────────────────────────\n';

  output += `${createBar(completed, total, 30)}  `;
  output += `${completed}/${total} (${percentage}%)\n\n`;

  // THROUGHPUT
  output += 'THROUGHPUT\n';
  output += '────────────────────────────────────────────\n';

  output += `Completed rate: ${throughput.toFixed(2)} jobs/sec\n\n`;

  // JOB TYPES
  output += 'BY JOB TYPE\n';
  output += '────────────────────────────────────────────\n';

  if (types.length === 0) {
    output += 'No jobs found.\n';
  }

  for (const job of types) {
    const typeTotal = Number(job.total);
    const typeCompleted = Number(job.completed);

    const typePercentage =
      typeTotal === 0 ? 0 : ((typeCompleted / typeTotal) * 100).toFixed(1);

    const typeName = String(job.type).slice(0, 15);

    output +=
      `${typeName.padEnd(15)} ` +
      `${createBar(typeCompleted, typeTotal, 20)} ` +
      `${typeCompleted}/${typeTotal} ` +
      `(${typePercentage}%)\n`;
  }

  output += '\n';

  // RECENT JOBS
  output += 'RECENT JOBS\n';
  output += '────────────────────────────────────────────\n';

  if (recent.length === 0) {
    output += 'No jobs found.\n';
  }

  for (const job of recent) {
    const icon = statusIcon(job.status);

    const typeName = String(job.type).slice(0, 14);

    output +=
      `#${String(job.id).padEnd(6)} ` +
      `${typeName.padEnd(15)} ` +
      `${icon} ${job.status}\n`;
  }

  output += '\n';

  output += `Updated: ${new Date().toLocaleTimeString()}\n`;

  output += 'Refresh: 2 seconds\n';

  process.stdout.write(output);
}

async function runMonitor() {
  try {
    const stats = await getStats();

    display(stats);
  } catch (error) {
    // Don't let one failed query stop the monitor
    process.stdout.write('\x1b[H\x1b[J');

    console.log('╔════════════════════════════════════════════╗');
    console.log('║            TASKFORGE MONITOR              ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    console.log('Monitor error:', error.message);
    console.log('');
    console.log('Retrying...');
  }

  // Refresh every 2 seconds
  setTimeout(runMonitor, 2000);
}

// Start monitor
await runMonitor();

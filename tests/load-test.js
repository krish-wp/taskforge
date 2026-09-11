import http from 'http';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TOTAL_JOBS = Number(process.env.TOTAL_JOBS) || 50;
const CONCURRENCY = Number(process.env.CONCURRENCY) || 1;
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL) || 500;
const POLL_TIMEOUT = Number(process.env.POLL_TIMEOUT) || 300_000;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const data = body ? JSON.stringify(body) : null;

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let payload = '';
        res.on('data', (chunk) => (payload += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(payload) });
          } catch {
            resolve({ status: res.statusCode, body: payload });
          }
        });
      },
    );

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runWithConcurrency(tasks, limit) {
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      await tasks[i]();
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, () => worker()),
  );
}

function formatMs(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${((ms % 60_000) / 1000).toFixed(0)}s`;
}

// ─── MAIN ─────────────────────────────────────────────────
async function main() {
  console.log('╔════════════════════════════════════╗');
  console.log('║      TASKFORGE LOAD TEST           ║');
  console.log('╚════════════════════════════════════╝\n');

  // Check server
  try {
    await request('GET', '/api/v1/dashboard/stats');
    console.log(`  Server:   ✓ ${BASE_URL}\n`);
  } catch {
    console.error(`  ✗ Cannot reach ${BASE_URL}\n`);
    process.exit(1);
  }

  // Phase 1: Create jobs
  const latencies = [];
  let created = 0;
  let createFailed = 0;
  const createStart = performance.now();

  const tasks = Array.from({ length: TOTAL_JOBS }, (_, i) => async () => {
    const start = performance.now();
    try {
      const res = await request('POST', '/api/v1/jobs', {
        type: 'test-task',
        payload: { index: i },
        priority: 'MEDIUM',
        max_attempts: 3,
      });
      latencies.push(performance.now() - start);
      res.status === 201 ? created++ : createFailed++;
    } catch {
      createFailed++;
    }
  });

  await runWithConcurrency(tasks, CONCURRENCY);
  const createTime = performance.now() - createStart;

  console.log(`  Created:  ${created}/${TOTAL_JOBS} (${createFailed} failed)`);

  // Phase 2: Wait for completion
  const waitStart = performance.now();

  while (performance.now() - waitStart < POLL_TIMEOUT) {
    try {
      const res = await request('GET', '/api/v1/dashboard/stats');
      const s = res.body;
      const done = (s.COMPLETED || 0) + (s.FAILED || 0);
      const pct = created > 0 ? ((done / created) * 100).toFixed(0) : 0;
      const elapsed = ((performance.now() - waitStart) / 1000).toFixed(1);
      process.stdout.write(
        `\r  [${elapsed}s] ${done}/${created} done (${pct}%)   `,
      );
      if (done >= created) break;
    } catch {}
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  const waitTime = performance.now() - waitStart;
  console.log('\n');

  // Phase 3: Report
  let metrics = {};
  try {
    const res = await request('GET', '/api/v1/dashboard/metrics');
    metrics = res.body;
  } catch {}

  const sorted = latencies.sort((a, b) => a - b);
  const avg = sorted.length
    ? sorted.reduce((a, b) => a + b, 0) / sorted.length
    : 0;
  const min = sorted[0] || 0;
  const max = sorted[sorted.length - 1] || 0;
  const createThroughput = created / (createTime / 1000);
  const execThroughput =
    ((metrics.completed || 0) + (metrics.failed || 0)) / (waitTime / 1000);

  const line = '─'.repeat(40);
  console.log(`  ${line}`);
  console.log('  RESULTS');
  console.log(`  ${line}\n`);
  console.log(`  Created:    ${created} | ${createFailed} failed`);
  console.log(
    `  Create:     ${createThroughput.toFixed(1)} jobs/sec | avg ${formatMs(avg)} | min ${formatMs(min)} | max ${formatMs(max)}`,
  );
  console.log(
    `  Completed:  ${metrics.completed || 0} | Failed: ${metrics.failed || 0}`,
  );
  console.log(`  Execute:    ${execThroughput.toFixed(2)} jobs/sec`);
  console.log(`  Total:      ${formatMs(createTime + waitTime)}\n`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

# TaskForge

A job queue system built with **Express 5**, **PostgreSQL**, and **Redis** — designed as a resume/portfolio project demonstrating backend infrastructure patterns.

---

## What it does

| Feature | Status |
|---------|--------|
| **Create jobs** (`POST /api/v1/jobs`) | ✅ Accepts `type`, `payload`, optional `priority`, `max_attempts` |
| **List jobs** (`GET /api/v1/jobs`) | ✅ Paginated with server-side status filter |
| **Get job by ID** (`GET /api/v1/jobs/:id`) | ✅ 404 if not found |
| **Update job** (`PUT /api/v1/jobs/:id`) | ✅ Partial updates via `COALESCE` |
| **Execution workers** | ✅ Forked child processes that dequeue and execute jobs with retry logic |
| **Recovery worker** | ✅ Resets stuck RUNNING jobs (>5min) and re-queues PENDING jobs |
| **Redis queue** (`LPUSH`/`BRPOP`) | ✅ FIFO queue with numbered workers |
| **Real-time dashboard** | ✅ Socket.io pushes job updates to frontend every 2s |
| **Frontend dashboard** | ✅ React + Vite + Tailwind with status cards, job table, and pagination |
| **Migrations** | ✅ 3 migration files, idempotent via `IF NOT EXISTS` |
| **Load test** | ✅ Concurrent job creation with progress bar and throughput report |

---

## API endpoints

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/jobs` | List jobs (paginated, filterable by status) |
| `POST` | `/api/v1/jobs` | Create a new job |
| `GET` | `/api/v1/jobs/:id` | Get job by ID |
| `PUT` | `/api/v1/jobs/:id` | Update a job |

**Query params for `GET /api/v1/jobs`:**
- `limit` — items per page (default: 50, max: 100)
- `offset` — pagination offset
- `status` — filter by status (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `RETRYING`, `CANCELLED`, `DEAD`)

**Response format:**
```json
{
  "jobs": [...],
  "pagination": {
    "total": 1250,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/dashboard/stats` | Job counts by status |
| `GET` | `/api/v1/dashboard/metrics` | Total, completed, failed, avg duration, throughput |
| `GET` | `/api/v1/dashboard/recent` | Last 50 updated jobs |

---

## Technical highlights

- **Forked child processes** — execution workers (configurable count, default 2) run in separate Node.js processes, auto-respawn on crash
- **Numbered workers** — each worker gets a `WORKER_ID` for consistent logging and tracing
- **Retry logic** — failed jobs re-queue up to `max_attempts`, then mark as `FAILED`
- **Recovery worker** — resets stuck `RUNNING` jobs (>5min) back to `PENDING` and re-queues them
- **Graceful degradation** — if Redis is down, jobs are still created in PostgreSQL and picked up later
- **Idempotent enqueue** — `WHERE queued_at IS NULL` guard prevents double-queuing
- **Parameterized SQL** — all queries use `$1`, `$2`, etc. (no string interpolation)
- **Server-side pagination** — `LIMIT`/`OFFSET` with status filtering, prevents loading all jobs
- **Real-time updates** — Socket.io polls DB and pushes changes to connected clients
- **Worker logging** — each worker writes to its own log file in `logs/`
- **Zero external config** — works out of the box; no `.env` required

---

## Project structure

```
taskforge/
├── src/
│   ├── server.js              # Entry point — forks workers, connects DB/Redis
│   ├── config/
│   │   ├── db.js              # pg Pool with connection events
│   │   └── redis.js           # Redis client + connectRedis / isRedisReady
│   ├── routes/
│   │   ├── jobs.routes.js     # Express router: GET /, POST /, GET /:id, PUT /:id
│   │   └── dashboard.routes.js
│   ├── controllers/
│   │   ├── jobs.controller.js    # CRUD + pagination + status filter
│   │   └── dashboard.controller.js
│   ├── queue/
│   │   └── queue.js           # enqueueJob (lPush) / dequeueJob (brPop)
│   ├── realtime/
│   │   └── socket.js          # Socket.io server, polls DB every 2s
│   ├── loging/
│   │   └── logger.js          # Per-worker file logging
│   └── worker/
│       ├── execution_worker.js   # Dequeues jobs, executes, handles retry
│       └── recovery_worker.js    # Resets stuck jobs, re-queues pending
├── dashboard/                 # Frontend (React + Vite + Tailwind)
│   └── src/
│       ├── App.jsx            # Dashboard + Jobs view with pagination
│       ├── main.jsx
│       └── index.css
├── tests/
│   └── load-test.js           # Concurrent job creation with progress bar
├── migrations/
│   ├── 001_create_jobs_table.sql
│   ├── 002_create_workers_table.sql
│   └── 003_add_queue_at_.sql
├── logs/                      # Per-worker log files (auto-created)
├── package.json
├── docker-compose.yml         # Postgres 17 + Redis 7
└── README.md
```

---

## Quick start (development)

```bash
# 1. Install deps
npm install

# 2. Start Postgres + Redis
docker-compose up -d

# 3. Run migrations (creates tables if missing)
npm run migrate

# 4. Start the server (forks 2 execution workers + 1 recovery worker)
npm run dev
# Server runs on http://localhost:3000

# 5. Start the dashboard (separate terminal)
cd dashboard && npm install && npm run dev
# Dashboard runs on http://localhost:5173
```

---

## Load test

```bash
# Run with defaults (50 jobs, concurrency 1)
npm run loadtest

# Custom settings
TOTAL_JOBS=200 CONCURRENCY=10 npm run loadtest
```

---

## License

MIT

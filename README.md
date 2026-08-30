# taskforge

A job queue system built with **Express 5**, **PostgreSQL**, and **Redis** — designed as a resume/portfolio project demonstrating backend infrastructure patterns.

---

## What it does

| Feature | Status |
|---------|--------|
| **Create jobs** (`POST /api/v1/jobs`) | ✅ Accepts `type`, `payload`, optional `priority`, `max_attempts` |
| **List all jobs** (`GET /api/v1/jobs`) | ✅ Returns all jobs (no pagination yet) |
| **Get job by ID** (`GET /api/v1/jobs/:id`) | ✅ 404 if not found |
| **Update job** (`PUT /api/v1/jobs/:id`) | ✅ Partial updates via `COALESCE` |
| **Recovery worker** | ✅ Forked child process that re-queues `PENDING` jobs with `queued_at IS NULL` |
| **Redis queue** (`LPUSH`/`BRPOP`) | ✅ Enqueue/dequeue implemented, but no consumer processes jobs yet |
| **Migrations** | ✅ 3 migration files, idempotent via `IF NOT EXISTS` |

---

## Technical highlights

- **Forked child process** — recovery worker runs in a separate Node.js process, auto-respawns on crash with 5s backoff
- **Async overlap prevention** — `setTimeout` chaining instead of `setInterval` guarantees no concurrent recovery runs
- **Graceful degradation** — if Redis is down, jobs are still created in PostgreSQL and picked up later by the recovery worker
- **Idempotent enqueue** — `WHERE queued_at IS NULL` guard prevents double-queuing the same job
- **Parameterized SQL** — all queries use `$1`, `$2`, etc. (no string interpolation)
- **Connection pooling** — `pg.Pool` handles connection lifecycle; transient errors don't kill the app
- **Zero external config** — works out of the box with sensible defaults; no `.env` required

---

## Roadmap — what could be added next

### Tier 1 — Core (makes the queue actually work)

1. **Consumer worker** — a process that `brPop`s job IDs from Redis, executes the job, updates status (`RUNNING`→`COMPLETED`/`FAILED`), and increments `attempts`. This is the biggest gap — without it, the queue drains nothing.

2. **Retry / attempt logic** — on failure, re-enqueue up to `max_attempts`, then mark `DEAD`. The schema already has `attempts` and `max_attempts`; this just wires them together.

3. **Priority queue** — replace single FIFO list with one Redis list per priority (`HIGH`/`MEDIUM`/`LOW`), pop highest first.

### Tier 2 — Reliability (schema already supports these)

4. **Worker heartbeats + stale-job reclaim** — the `workers` table has `last_heartbeat` and `current_job_id`. A crashed worker's `RUNNING` job gets automatically re-queued after a timeout.

5. **Dead-letter queue** — jobs exceeding `max_attempts` move to a separate Redis list for inspection instead of being silently lost.

### Tier 3 — API & polish

6. **Pagination** — add `limit`/`offset` to `GET /api/v1/jobs`
7. **DELETE endpoint** — complete the CRUD surface
8. **Input validation** — reject malformed payloads before they hit the DB
9. **Health check** — `GET /api/v1/health` returning `DB: ok, Redis: ok`
10. **`.env` + `dotenv`** — `.env.example` for quick setup
11. **Migration tracking** — `schema_migrations` table instead of re-running all files

---

## Project structure

```
taskforge/
├── src/
│   ├── server.js            # Entry point — creates app, forks recovery worker, connects DB/Redis
│   ├── config/
│   │   ├── db.js            # pg Pool with connection events
│   │   └── redis.js         # Redis client + connectRedis / isRedisReady
│   ├── routes/
│   │   └── jobs.routes.js   # Express router: GET /, POST /, GET /:id, PUT /:id
│   ├── controllers/
│   │   └── jobs.controller.js  # Business logic: create, getAll, getById, update
│   ├── queue/
│   │   ├── queue.js         # enqueueJob (lPush) / dequeueJob (brPop)
│   │   └── test-queue.js    # Manual script to verify enqueue/dequeue
│   └── worker/
│       └── recovery_worker.js  # Forked child: recovers unqueued PENDING jobs every 60s
├── migrations/
│   ├── 001_create_jobs_table.sql
│   ├── 002_create_workers_table.sql
│   └── 003_add_queue_at_.sql
├── package.json             # Dependencies: express, pg, redis, nodemon
├── docker-compose.yml       # Postgres + Redis services
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

# 4. Start the server
npm run dev
# Server runs on http://localhost:3000
# Recovery worker forks automatically and respawns on crash
```

---

## License

MIT

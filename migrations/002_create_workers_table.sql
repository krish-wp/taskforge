CREATE TABLE IF NOT EXISTS workers (
  id SERIAL PRIMARY KEY,
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DEAD')),
  last_heartbeat TIMESTAMP DEFAULT NOW(),
  current_job_id INTEGER REFERENCES jobs(id),
  started_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workers_status ON workers(status);
CREATE INDEX IF NOT EXISTS idx_workers_current_job ON workers(current_job_id);

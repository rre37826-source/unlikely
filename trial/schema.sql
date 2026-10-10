-- Migration source only. Apply through the host's Drizzle/D1 migration workflow.
-- Never execute this schema from a request handler.
CREATE TABLE trial_requests (
  request_id TEXT PRIMARY KEY NOT NULL,
  session_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('generate', 'expand', 'synthesize')),
  day_bucket TEXT NOT NULL,
  month_bucket TEXT NOT NULL,
  reserved_microyuan INTEGER NOT NULL CHECK (reserved_microyuan > 0),
  admitted_at INTEGER NOT NULL,
  lease_until INTEGER NOT NULL,
  completed_at INTEGER,
  outcome TEXT
);
CREATE INDEX trial_month ON trial_requests (month_bucket);
CREATE INDEX trial_day ON trial_requests (day_bucket);
CREATE INDEX trial_session_day ON trial_requests (session_hash, day_bucket);
CREATE INDEX trial_ip_day ON trial_requests (ip_hash, day_bucket);
CREATE INDEX trial_lease ON trial_requests (lease_until);

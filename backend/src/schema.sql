-- Bug Tracker Lite database schema (PostgreSQL 16+)
-- gen_random_uuid() is built into Postgres (core since v13).

CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,               -- bcrypt hash
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bugs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  severity    TEXT NOT NULL CHECK (severity IN ('low', 'med', 'high')),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'closed')),
  image_key   TEXT,                        -- S3 object key, null when no screenshot
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supports the two most common queries:
--   WHERE user_id = ? ORDER BY created_at DESC            (dashboard, all)
--   WHERE user_id = ? AND status = ? ORDER BY created_at DESC  (filtered)
CREATE INDEX IF NOT EXISTS bugs_user_status_created_idx
  ON bugs (user_id, status, created_at DESC);
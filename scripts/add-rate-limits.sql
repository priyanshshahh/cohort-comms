-- Issue #21: per-user rate limiting on write endpoints.
-- Apply by hand like the other scripts here:
--   psql "$DATABASE_URL" -f scripts/add-rate-limits.sql
-- (or run the statement in the Neon SQL editor). `drizzle-kit push` from the
-- declared schema produces the same table on a fresh deploy.

CREATE TABLE IF NOT EXISTS rate_limits (
  user_id text NOT NULL,
  bucket text NOT NULL,
  window_start bigint NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket, window_start)
);

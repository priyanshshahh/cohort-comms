-- Cohort space migration (PR #13).
--
-- Run this ONCE against the production database before the deployed code
-- serves an authenticated request:
--
--   psql "$DATABASE_URL" -f scripts/migrate-cohort-space.sql
--
-- Why this exists rather than `drizzle-kit push`: push would add
-- users.status with its DEFAULT 'pending' and stop there, which locks every
-- existing member out of the workspace, including the admins who would have
-- to let them back in. The backfill below has to happen in the same
-- transaction as the column, so it is written out explicitly.
--
-- Idempotent. Safe to run twice.

BEGIN;

-- Emails admitted to the cohort automatically at first sign-in.
CREATE TABLE IF NOT EXISTS cohort_allowlist (
  email      text PRIMARY KEY,
  added_by   text,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Replay protection for the Forth webhook. Previously created by hand on the
-- live database and present in no schema file, so a fresh deploy had a
-- webhook that threw on every delivery.
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id    text PRIMARY KEY,
  received_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email       text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status      text NOT NULL DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at timestamp;

-- Everyone already in the workspace was there before admission existed, so
-- they are the cohort by definition. Without this they would all land on the
-- waiting screen the moment this migration runs.
UPDATE users SET status = 'active', approved_at = now()
WHERE status = 'pending';

COMMIT;

-- Sanity check. Expect zero pending members immediately after migrating.
SELECT status, count(*) FROM users GROUP BY status;

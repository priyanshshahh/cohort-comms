-- Personal channels (open-app model).
--
--   psql "$DATABASE_URL" -f scripts/add-personal-channels.sql
--
-- Anyone can sign up and use the app straight away with their own channels.
-- The cohort's channels stay closed until an admin admits them.
--
-- owner_id null  = cohort channel, shared with every admitted member
-- owner_id set   = that member's own channel, visible only to them
--
-- Idempotent.

ALTER TABLE channels ADD COLUMN IF NOT EXISTS owner_id text;

-- Existing channels are the cohort's, so they stay null. Stated explicitly
-- rather than relied on, in case this runs against a partly-migrated database.
UPDATE channels SET owner_id = NULL WHERE is_default = true;

CREATE INDEX IF NOT EXISTS channels_owner_idx ON channels (owner_id);

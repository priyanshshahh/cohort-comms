-- Fresh start for the GitHub-auth launch.
--
--   psql "$DATABASE_URL" -f scripts/reset-for-github-auth.sql
--
-- DESTRUCTIVE. Drops every message, DM, reaction, notification and member.
--
-- Why a wipe rather than a migration: users.id was the Clerk user id, and
-- messages.author_id, dm_key, reactions.user_id, reads.user_id and
-- notifications all reference it. Moving to GitHub OAuth changes every id, so
-- the old rows would point at accounts that can no longer sign in. Relinking
-- by email was the alternative; a clean launch was chosen instead.
--
-- Supersedes scripts/migrate-cohort-space.sql, which is no longer needed:
-- this file creates the finished schema in one pass.

BEGIN;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS reactions;
DROP TABLE IF EXISTS typing;
DROP TABLE IF EXISTS reads;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS channels;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS cohort_allowlist;
DROP TABLE IF EXISTS webhook_events;

-- `id` is the GitHub account id. Stable across name and handle changes,
-- unlike the login itself.
CREATE TABLE users (
  id           text PRIMARY KEY,
  handle       text NOT NULL,
  name         text NOT NULL,
  avatar_url   text,
  email        text,
  status       text NOT NULL DEFAULT 'pending',
  approved_by  text,
  approved_at  timestamp,
  last_seen_at timestamp NOT NULL DEFAULT now(),
  created_at   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE cohort_allowlist (
  email      text PRIMARY KEY,
  added_by   text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE channels (
  id          serial PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  is_default  boolean NOT NULL DEFAULT false,
  admin_only  boolean NOT NULL DEFAULT false,
  archived    boolean NOT NULL DEFAULT false,
  created_by  text,
  created_at  timestamp NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id             serial PRIMARY KEY,
  channel_id     integer,
  dm_key         text,
  author_id      text NOT NULL,
  body           text NOT NULL,
  parent_id      integer,
  attachment_url text,
  edited_at      timestamp,
  created_at     timestamp NOT NULL DEFAULT now()
);
CREATE INDEX messages_channel_idx ON messages (channel_id, id);
CREATE INDEX messages_dm_idx      ON messages (dm_key, id);
CREATE INDEX messages_parent_idx  ON messages (parent_id, id);

CREATE TABLE notifications (
  id         serial PRIMARY KEY,
  user_id    text NOT NULL,
  actor_id   text NOT NULL,
  kind       text NOT NULL,
  message_id integer NOT NULL,
  scope      text NOT NULL,
  preview    text NOT NULL,
  read_at    timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, id);

CREATE TABLE reads (
  id                   serial PRIMARY KEY,
  user_id              text NOT NULL,
  scope                text NOT NULL,
  last_read_message_id integer NOT NULL DEFAULT 0,
  updated_at           timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX reads_user_scope_idx ON reads (user_id, scope);

CREATE TABLE typing (
  scope      text NOT NULL,
  user_id    text NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, user_id)
);

CREATE TABLE reactions (
  id         serial PRIMARY KEY,
  message_id integer NOT NULL,
  user_id    text NOT NULL,
  emoji      text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX reactions_unique_idx ON reactions (message_id, user_id, emoji);

-- Replay protection for the Forth webhook.
CREATE TABLE webhook_events (
  event_id    text PRIMARY KEY,
  received_at timestamp NOT NULL DEFAULT now()
);

COMMIT;

-- The app seeds its default channels on the first authenticated page load,
-- so nothing else is required here.
--
-- Next: put the cohort's emails on the roster at /admin, or insert them
-- directly, e.g.
--   INSERT INTO cohort_allowlist (email) VALUES ('member@example.edu');

# Cohort Comms

Official communications platform for the Hult Cohort Developer Program (Summer
Pilot 2026, Week 2 winner). Channels, DMs, threads, reactions, search, and a
**Forth** integration — inbound webhook receiver, deep-link cards, and an
embedded board pane.

**Production:** https://cohort-comms-phi.vercel.app

## Reviewers: start here (no signup)

**▶ Interactive live demo:** https://cohort-comms-phi.vercel.app/demo

Post, react, open threads/DMs, and run the Forth tour without an account.
Local-only React state — nothing writes to the live cohort DB. Look for the
amber `WEBHOOK` badge in `#general` (simulated bot message, not a live Forth
push).

Sign in with GitHub or Google at the production URL. New accounts land in a
personal space; an admin admits them into the shared cohort workspace.

## Access model

| Who | What they get |
|---|---|
| Anyone | Demo (`/demo`), landing, sign-in / register |
| Signed-in (pending) | Personal channels only; admins get a join-request bell + Roster badge |
| Admitted (`status=active`) | Cohort channels, DMs, roster, FTS search |
| Admin (`ADMIN_HANDLES` / `ADMIN_EMAILS`) | `/admin` roster: admit, revoke, email allowlist |

Emails on `cohort_allowlist` are auto-admitted on first sign-in. Everyone else
registers as `pending` until an admin admits them.

## Features

| Feature | Status |
|---|---|
| Open signup | GitHub + Google OAuth; pending until admin admit |
| Personal space while pending | Create private channels before cohort access |
| Admin join notifications | Bell `join_request` + Roster pending badge |
| Channels | Seeded `#announcements`, `#general`, `#project-2`, `#peer-review`, `#help`; members can create more |
| Admin announcements | `#announcements` is read-only unless admin |
| Direct messages | 1:1 only; key = sorted participant ids joined with `~` |
| Threads | One-level replies; nested replies rejected |
| Reactions | Toggle allowlist: 👍 🎉 🔥 👀 ✅ ❤️ |
| Search + ⌘K | Postgres FTS; command palette |
| Unread + presence | Per-conversation read cursors; online ~2 min |
| @mentions | Autocomplete + notification bell |
| Image attach | Vercel Blob when configured; without it, data URL in dev, disabled in production |
| Typing indicators | Current conversation |
| Catch me up | Skim recent others’ messages |
| Light / dark | Theme toggle |
| Interactive `/demo` | Full walkthrough without signing in |
| Forth board embed | Split-pane iframe beside chat |
| Forth deep-link cards | Pasted Forth URLs → labelled cards |
| Forth inbound webhook | Receiver live; Forth does **not** send outbound events yet |

### Not implemented

- Nested threads / group DMs
- Push / email notifications (in-app bell only)
- Automatic Forth → Comms posts on ticket ship

### Known limitations

These are real gaps, not oversights waiting to be discovered. Each one has an
open issue with context and a suggested starting point, and each is open for
anyone to pick up. Nothing here blocks day-to-day use; the first two are what
stand between this and being something a cohort should fully depend on.

| Limitation | Impact | Issue |
|---|---|---|
| No message delete or edit | A message with a leaked key or a regretted screenshot is permanent short of manual SQL | [#19](https://github.com/priyanshshahh/cohort-comms/issues/19) |
| No rate limiting | One user or a bad retry loop can flood a channel and the row quota | [#21](https://github.com/priyanshshahh/cohort-comms/issues/21) |
| No error monitoring | Production failures are found by someone noticing, not by an alert | [#22](https://github.com/priyanshshahh/cohort-comms/issues/22) |
| No verified backup / restore | Neon retention unconfirmed, restore never tested, migrations applied by hand | [#23](https://github.com/priyanshshahh/cohort-comms/issues/23) |

Picking one up: comment on the issue first so two people do not start the same
work. Authorization rules belong in `src/lib/policy.ts`, which imports nothing
but the standard library, with tests in `tests/security.test.ts`. CI runs
`npm test` and `tsc --noEmit` on every pull request.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16.2 (App Router), React 19 |
| Auth | Auth.js v5 (`next-auth`) — GitHub + Google OAuth |
| Database | Neon Postgres via Drizzle ORM |
| Realtime | SSE (`/api/events`) + SWR fallback |
| Uploads | `@vercel/blob` (optional) |
| Hosting | Vercel |
| Tests | Vitest (`npm test`) |

### Auth note

Auth.js on `*.vercel.app` is production auth (no custom domain required). The
previous Clerk setup needed DNS you control and was abandoned.

Sign-in shows a provider button only when that provider’s env vars are set.
GitHub is live in production. Google appears after `AUTH_GOOGLE_ID` /
`AUTH_GOOGLE_SECRET` are set on Vercel.

### Realtime (SSE + SWR)

Signed-in chat opens `EventSource` on `/api/events?scope=…` (~800ms poll of
max message id, ~25s connection). While Live, SWR does not poll; if the stream
drops, SWR resumes ~2s polling.

## Routes

| Path | Auth | Behavior |
|---|---|---|
| `/` | Public | Landing; signed-in → `/c/general` |
| `/demo` | Public | Interactive local-only walkthrough |
| `/sign-in` | Public | Auth.js (GitHub / Google) |
| `/c/[slug]` | Required | Channel chat (cohort channels need admission) |
| `/dm/[userId]` | Required | 1:1 DM (cohort members only) |
| `/admin` | Admin | Roster: pending queue + allowlist |
| `/robots.txt`, `/sitemap.xml`, `/llms.txt` | Public | SEO / agent summary |

Auth gate: [`src/proxy.ts`](src/proxy.ts). Public routes above plus
`/api/auth/*` and `/api/webhooks/*`. Everything else requires a session.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/bootstrap` | Me (+ admin, cohortMember, pendingCount), channels, members |
| `POST` | `/api/channels` | Create channel (personal if pending; cohort if admitted) |
| `GET`/`POST` | `/api/messages` | History / post; `403` if pending on cohort scopes |
| `GET` | `/api/events` | SSE near-realtime |
| `GET` | `/api/search` | FTS (cohort members only) |
| `POST` | `/api/reactions` | Toggle reaction |
| `GET`/`PATCH` | `/api/notifications` | Bell inbox (incl. `join_request`) |
| `GET`/`POST` | `/api/typing` | Typing indicators |
| `POST` | `/api/upload` | Image upload |
| `GET`/`POST` | `/api/admin/members` | Admit / revoke / allowlist |
| `POST` | `/api/webhooks/forth` | Inbound Forth events |

**Scopes:** `channel:<slug>`, `dm:<otherUserId>`, `thread:<rootId>`.

## Rate limits

Write endpoints are throttled per authenticated user over a sliding one-minute
window (issue #21):

| Endpoint | Limit per minute |
|---|---|
| `POST /api/messages` | 30 |
| `POST /api/reactions` | 60 |
| `POST /api/typing` | 120 |
| `POST /api/upload` | 12 |

Over the limit returns `429` with a `Retry-After` header. The counters live in
Postgres (`rate_limits`, created by `scripts/add-rate-limits.sql`), no new
dependency; at most two rows per user and endpoint. If the limiter itself
errors, the write proceeds (fail open), so a limiter fault can never take
posting down. Limits are set in `src/lib/rateLimit.ts`.

## Environment

Copy `.env.example` → `.env.local` (or `vercel env pull`).

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Neon connection string |
| `AUTH_SECRET` | Yes | Auth.js session secret (`npx auth secret`) |
| `AUTH_URL` | Recommended | e.g. `https://cohort-comms-phi.vercel.app` |
| `AUTH_TRUST_HOST` | Recommended | `true` on Vercel |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | For GitHub | OAuth app; callback `/api/auth/callback/github` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | For Google | OAuth client; callback `/api/auth/callback/google` |
| `FORTH_WEBHOOK_SECRET` | For webhook | Missing → `503` |
| `BLOB_READ_WRITE_TOKEN` | For attachments in production | Vercel Blob uploads; unset → uploads answer `503` in production, data-URL fallback in dev |
| `ADMIN_HANDLES` | Optional | Default `rogerSuperBuilderAlpha,priyanshshahh` |
| `ADMIN_EMAILS` | Optional | Needed for Google-only admins |

## Local setup

```bash
npm install
cp .env.example .env.local     # or: vercel env pull
npx dotenv -e .env.local -- npx drizzle-kit push
npm run dev
```

```bash
npm run build
npm test
npm run lint
```

## Architecture

```
src/
  auth.ts                       Auth.js — GitHub + Google
  proxy.ts                      Session gate; public /, /demo, /api/auth, webhook
  db/schema.ts                  users (status), cohort_allowlist, channels…
  lib/data.ts                   sync, admit, join_request notify, scopes
  lib/policy.ts                 admins, scopes, Forbidden/Pending errors
  app/(app)/admin               roster UI
  app/api/admin/members         admit / revoke / allowlist
  app/api/webhooks/forth        inbound Forth webhook
  components/Shell.tsx          pending banner + Roster badge
  components/AdminRoster.tsx    admin queue
  components/NotificationBell.tsx
```

## Forth integration

Forth does **not** publish outbound webhooks. Comms ships the inbound receiver
at `POST /api/webhooks/forth` (shared secret, URL allowlist, replay protection).
Shipping a ticket on Forth will not post into chat until Forth or a relay calls
that endpoint.

## Links

- [Production](https://cohort-comms-phi.vercel.app)
- [Interactive demo](https://cohort-comms-phi.vercel.app/demo)
- [Forth board](https://forth-bice.vercel.app)
- [Submission PR](https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/118)

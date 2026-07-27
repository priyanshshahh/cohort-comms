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

Sign in at the production URL for the real workspace (SSE live updates,
@mention inbox, image attach, Postgres-backed history).

## Features

| Feature | Status |
|---|---|
| Channels | Seeded `#announcements`, `#general`, `#project-2`, `#peer-review`, `#help`; members can create more |
| Admin announcements | `#announcements` is read-only unless handle is in `ADMIN_HANDLES` |
| Direct messages | 1:1 only; key = sorted participant ids joined with `~` |
| Threads | One-level replies; nested replies rejected; live reply counts on roots |
| Reactions | Toggle allowlist: 👍 🎉 🔥 👀 ✅ ❤️ |
| Search + ⌘K | Postgres FTS; command palette jumps to channels/members and searches messages |
| Unread + presence | Per-conversation read cursors; online if `lastSeenAt` within ~2 min |
| @mentions | Autocomplete chips + notification bell (mention / DM / reply) |
| Image attach | Composer upload; Vercel Blob when configured, else data URL |
| Typing indicators | Who is composing in the current conversation |
| Catch me up | Skim of recent others’ messages when opening a busy channel |
| Light / dark | Theme toggle (`localStorage` + `.dark`) |
| Interactive `/demo` | Full walkthrough without signing in |
| Forth board embed | Split-pane iframe beside chat (default open) |
| Forth deep-link cards | Pasted `forth-bice.vercel.app` URLs → labelled cards |
| Forth inbound webhook | Receiver live; Forth does **not** send outbound events yet |

### Not implemented (schema/UI gaps)

- Message edit / delete (`edited_at` exists; no API or UI)
- Nested threads
- Group / multi-party DMs
- Channel archive UI (`archived` filtered in bootstrap only)
- Push / email notifications (in-app bell only)
- Automatic Forth → Comms posts (Forth publishes no outbound webhooks)

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16.2 (App Router), React 19 |
| Auth | Auth.js v5 (`next-auth`) with GitHub OAuth |
| Database | Neon Postgres via Drizzle ORM |
| Realtime | SSE (`/api/events`) + SWR fallback while the stream is down |
| Uploads | `@vercel/blob` (optional) |
| Hosting | Vercel |
| Tests | Vitest (`npm test`) |

Neon is provisioned through the Vercel Marketplace. Auth is a GitHub OAuth app.

### Auth note

Auth is a **production** deployment. Auth.js with a GitHub OAuth app has no
DNS requirement, so it runs as real production auth on `*.vercel.app` with no
custom domain, no "development mode" badge, and no user cap. The previous
Clerk setup could not: Clerk production instances need DNS records on a domain
you control.

Access is limited to the cohort. Emails on the roster (`cohort_allowlist`) are
admitted automatically at first sign-in; everyone else waits on the approval
screen until an admin admits them at `/admin`.

### Realtime (SSE + SWR)

Signed-in chat opens `EventSource` on `/api/events?scope=…`, which polls
`max(message id)` ~every 800ms and pushes when it advances (~25s connection
lifetime). While Live, SWR does not poll; if the stream drops, SWR resumes ~2s
polling. Sidebar bootstrap refreshes ~5s; notification bell ~4s.

## Routes

| Path | Auth | Behavior |
|---|---|---|
| `/` | Public | Landing; signed-in users redirect to `/c/general` |
| `/demo` | Public | Interactive local-only walkthrough |
| `/sign-in` | Public | Auth.js |
| `/c/[slug]` | Required | Channel chat |
| `/dm/[userId]` | Required | 1:1 DM |
| `/robots.txt`, `/sitemap.xml`, `/llms.txt` | Public | SEO / agent summary |

Auth gate: `src/proxy.ts` (Next.js 16 Proxy). Public routes above plus
`/api/webhooks(.*)`. Everything else requires `auth.protect()`.

## API

Authenticated APIs use `requireUserId` / `syncCurrentUser` except the
Forth webhook.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/bootstrap` | Me (+ admin), channels + unread, members + presence + DM unread |
| `POST` | `/api/channels` | Create channel (slugified name, max 32 chars) |
| `GET` | `/api/messages?scope=` | History + reactions; marks conversation read |
| `POST` | `/api/messages` | Post text (≤ 8000) or attachment; scopes below |
| `GET` | `/api/events?scope=&after=` | SSE: `hello` / `message` / `ping` / `error` |
| `GET` | `/api/search?q=` | FTS (`websearch_to_tsquery`); min 2 chars |
| `POST` | `/api/reactions` | Toggle reaction |
| `GET`/`PATCH` | `/api/notifications` | Bell inbox; mark one/all read |
| `GET`/`POST` | `/api/typing` | Pulse typing; list typers active in last 4s |
| `POST` | `/api/upload` | Image only, ~900KB |
| `POST` | `/api/webhooks/forth` | Inbound board events → channel as Forth bot |

**Scopes:** `channel:<slug>`, `dm:<otherUserId>`, `thread:<rootId>`.

## Demo vs production

| | `/demo` | Signed-in workspace |
|---|---|---|
| Data | In-memory React state | Neon Postgres |
| Auth | None | GitHub OAuth |
| Forth webhook | Seeded bot message + amber badge | Real `POST /api/webhooks/forth` → DB |
| Realtime | None | SSE + SWR |
| Notifications / typing / upload / FTS | Simulated or absent | Full APIs |
| Persist | Lost on refresh | Durable |

## Environment

Copy `.env.example` → `.env.local` (or `vercel env pull`).

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Neon connection string |
| `AUTH_SECRET` | Yes | Auth.js session secret (`npx auth secret`) |
| `AUTH_GITHUB_ID` | Yes | GitHub OAuth app client id |
| `AUTH_GITHUB_SECRET` | Yes | GitHub OAuth app client secret |
| `FORTH_WEBHOOK_SECRET` | For webhook | Missing → webhook returns `503` |
| `BLOB_READ_WRITE_TOKEN` | Optional | Vercel Blob uploads; else data URL |
| `ADMIN_HANDLES` | Optional | Comma-separated handles; default `admin,priyanshshahh` |

## Local setup

```bash
npm install
cp .env.example .env.local     # or: vercel env pull
npx dotenv -e .env.local -- npx drizzle-kit push
npm run dev
```

```bash
npm run build   # production build
npm test        # vitest (Forth URL allowlist, admin gating, scopes)
npm run lint
```

CI (`.github/workflows/ci.yml`): `npm ci` → `npm test` → `npx tsc --noEmit`
on push/PR to `main`.

## Architecture

```
src/
  proxy.ts                      Auth gate; public /, /demo, webhook, SEO
  db/schema.ts                  users, channels, messages, reads, notifications,
                                typing, reactions
  lib/data.ts                   scopes, posts, unread, FTS, Forth bot, admins
  lib/forth.ts                  Forth URL normalize + card labels
  app/api/webhooks/forth        inbound Forth webhook (secret + allowlist)
  app/api/events                SSE near-realtime
  app/api/notifications         bell inbox
  app/api/upload                image attachments
  app/api/typing                typing indicators
  components/DemoWorkspace.tsx  no-signup interactive demo
  components/ChatView.tsx       SSE, threads, attach, Forth cards
  components/Shell.tsx          sidebar + Forth iframe pane
  components/NotificationBell.tsx
  components/CommandPalette.tsx
```

One `messages` table backs channels and DMs (`channel_id` vs sorted `dm_key`).
Threads use `parent_id` on the same table.

### Schema extras (Neon, not in `schema.ts`)

These are used at runtime and must exist in the database (created via prior
SQL / push):

- `messages.search_vector` — full-text search
- `webhook_events(event_id)` — webhook replay dedupe

There is no `drizzle/` migrations folder; schema is applied with
`drizzle-kit push`.

## Forth integration

Forth (https://forth-bice.vercel.app, https://github.com/CodingWCal/forth) is
Next.js + Firebase and does **not** publish outbound webhooks or a public REST
API today. Cohort Comms ships the **receiving** half of the contract, plus
embeds and cards. Shipping a ticket on Forth will **not** by itself post into
chat until Forth (or a relay) calls this endpoint.

### 1. Inbound webhook (receiver live)

`POST /api/webhooks/forth` with header `x-forth-secret` matching
`FORTH_WEBHOOK_SECRET`. Secret compare is constant-time. Only same-origin Forth
links are kept; hostile URLs are stripped. Replay protection uses optional
`payload.id` → `webhook_events` dedupe and optional `sentAt` (±5 min window).

Posts as the Forth bot (`id = forth-bot`, handle `forth`) into
`payload.channel` or `#general`.

Verified on production (manual curl):

| Case | Result |
|---|---|
| Wrong / missing secret | `401` |
| Missing `ticket.title` | `400` |
| Valid shipped ticket | `201` — posts as Forth bot into the channel |
| Payload with `https://evil.example.com/…` | `201`, hostile URL stripped |
| Missing `FORTH_WEBHOOK_SECRET` | `503` |

```bash
curl -X POST https://cohort-comms-phi.vercel.app/api/webhooks/forth \
  -H 'content-type: application/json' \
  -H 'x-forth-secret: <FORTH_WEBHOOK_SECRET>' \
  -d '{"event":"ticket.shipped","channel":"general",
       "ticket":{"title":"Ship Cohort Comms","status":"Shipped",
                 "assignee":"priyanshshahh",
                 "url":"https://forth-bice.vercel.app/#chronicle"}}'
```

Status icons in the bot message: shipped ✅, in forge 🔨, camped ⛺, quest log 📋,
otherwise ⚒.

### 2. Embedded board

Toggleable split-pane iframe of Forth beside chat (plus “Open in tab”). Mutually
exclusive with the thread side panel. Embed was checked against Forth response
headers (no blocking `X-Frame-Options` / frame CSP) before shipping.

### 3. Deep-link cards

Any `forth-bice.vercel.app` URL pasted into chat (or delivered by the webhook)
renders as a labelled card. Paths are normalized to Forth’s SPA hash routes
(`/#board`, `/#chronicle`, …) so Open does not 404 — Forth only serves `/`
server-side; client views are React state.

### 4. Shared identity

Sign in with the same GitHub account you use on Forth (
Google/GitHub on Forth). That is the curriculum’s cross-tool identity story,
not a technical SSO link.

## Links

- [Production](https://cohort-comms-phi.vercel.app)
- [Interactive demo](https://cohort-comms-phi.vercel.app/demo)
- [Forth board](https://forth-bice.vercel.app)
- [Submission PR](https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/118)

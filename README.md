# Cohort Comms

Internal communications for the Hult Cohort Developer Program (Summer Pilot 2026,
Project 2). Channels, DMs, threads, and a live **Forth** integration — webhook,
deep-link cards, and an embedded board pane.

**Production:** https://cohort-comms-phi.vercel.app

## Reviewers: start here (no signup)

**▶ Interactive live demo:** https://cohort-comms-phi.vercel.app/demo

Post, react, open threads/DMs, and run the 30-second Forth tour without an
account. Local-only state — nothing writes to the live cohort DB. Look for the
amber `WEBHOOK` badge in `#general`.

Sign in at the production URL to use the real workspace (SSE live updates,
@mention inbox, image attach).

## Features

- **Channels** — seeded `#general`, `#project-2`, `#peer-review`, `#help`, plus
  admin-only `#announcements`
- **Direct messages** — 1:1, keyed by sorted participant ids
- **Threads** — one-level replies with live reply counts on roots
- **Reactions** — emoji reactions on messages
- **Search + ⌘K** — Postgres FTS and a command palette
- **Unread + presence** — per-conversation read cursors; online within ~2 min
- **@mentions** — autocomplete chips + notification bell inbox
- **Image attach** — composer upload (Vercel Blob when configured, else data URL)
- **Light / dark** — theme toggle
- **Interactive `/demo`** — full walkthrough without Clerk

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Auth | Clerk (`@clerk/nextjs` v7) — Marketplace instance |
| Database | Neon Postgres via Drizzle ORM |
| Realtime | SSE (`/api/events`) + SWR fallback while the stream is down |
| Hosting | Vercel |

Clerk and Neon are provisioned through the Vercel Marketplace.

### Auth note

The live deploy currently uses a **Clerk development** instance (`pk_test_…`)
because `*.vercel.app` cannot satisfy production Clerk DNS. The UI may show a
“Development mode” badge. Enable the social providers you want in the Clerk
dashboard (Google is live today; add GitHub there if you need both).

### Realtime (SSE + SWR)

Signed-in chat opens `EventSource` on `/api/events?scope=…`, which polls
`max(message id)` and pushes when it advances. While Live, SWR does not poll;
if the stream drops, SWR resumes ~2s polling as a safety net. At cohort scale
this avoids WebSocket connection lifecycle on serverless without pretending
delivery is instantaneous.

## Local setup

```bash
npm install
cp .env.example .env.local     # or: vercel env pull
npx dotenv -e .env.local -- npx drizzle-kit push
npm run dev
```

```bash
npm run build   # production build + typecheck
npm test        # vitest (incl. security cases)
```

## Architecture

```
src/
  proxy.ts                      Clerk gate; public /, /demo, webhook
  db/schema.ts                  users, channels, messages, reads, notifications
  lib/data.ts                   scopes, messages, unread, notifications, SSE cursor
  lib/forth.ts                  Forth URL normalize + card labels
  app/api/webhooks/forth        inbound Forth webhook (secret + allowlist)
  app/api/events                SSE near-realtime
  app/api/notifications         bell inbox
  app/api/upload                image attachments
  components/DemoWorkspace.tsx  no-signup interactive demo
  components/ChatView.tsx       SSE, threads, attach, Forth cards
  components/NotificationBell.tsx
```

One `messages` table backs channels and DMs (`channel_id` vs sorted `dm_key`).
Threads use `parent_id` on the same table.

## Forth integration

Forth (https://forth-bice.vercel.app, https://github.com/CodingWCal/forth) is
Next.js + Firebase and does **not** publish outbound webhooks today. Cohort
Comms still ships the **receiving** half of the contract, plus embeds and cards.

### 1. Inbound webhook (live)

`POST /api/webhooks/forth` with header `x-forth-secret` matching
`FORTH_WEBHOOK_SECRET`. Secret compare is constant-time. Only same-origin Forth
links are kept; hostile URLs are stripped. Replay protection uses `event_id`
dedupe + a stale `sentAt` window.

Verified on production:

| Case | Result |
|---|---|
| Wrong / missing secret | `401` |
| Missing `ticket.title` | `400` |
| Valid shipped ticket | `201` — posts as Forth bot into the channel |
| Payload with `https://evil.example.com/…` | `201`, hostile URL stripped |

```bash
curl -X POST https://cohort-comms-phi.vercel.app/api/webhooks/forth \
  -H 'content-type: application/json' \
  -H 'x-forth-secret: <FORTH_WEBHOOK_SECRET>' \
  -d '{"event":"ticket.shipped","channel":"general",
       "ticket":{"title":"Ship comms","status":"Shipped",
                 "assignee":"priyanshshahh",
                 "url":"https://forth-bice.vercel.app/#chronicle"}}'
```

### 2. Embedded board

Toggleable split-pane iframe of Forth beside chat (plus “Open in tab”). Embed
was checked against Forth response headers (no blocking `X-Frame-Options` /
frame CSP) before shipping.

### 3. Deep-link cards

Any `forth-bice.vercel.app` URL pasted into chat (or delivered by the webhook)
renders as a labelled card. Paths are normalized to Forth’s SPA hash routes
(`/#board`, `/#chronicle`, …) so Open does not 404.

### 4. Shared identity

Sign in with the same email you use on Forth (Clerk on Comms; Google/GitHub on
Forth). That is the curriculum’s cross-tool identity story.

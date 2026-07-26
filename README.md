# Cohort Comms

Internal communications platform for the Hult Cohort Developer Program
(Summer Pilot 2026, Project 2). Replaces Discord as the cohort's primary
channel: public channels, direct messages, unread notifications, and
first-class links into **Forth**, the cohort's project management platform.

**Production:** https://cohort-comms-phi.vercel.app

## Features

- **Channels** — `#general`, `#project-2`, `#peer-review`, `#help` are seeded on
  first boot; any member can open another from the sidebar.
- **Direct messages** — one-to-one with any enrolled participant. Conversations
  are keyed by the sorted pair of user ids, so there are no conversation records
  to manage.
- **Unread notifications** — per-conversation read cursors drive unread badges in
  the sidebar and a total count in the mobile header.
- **Presence** — a member shows as online when seen within the last two minutes.
- **Forth-aware messages** — paste a link to the Forth board and it renders as a
  card labelled with the view it points at (Quest Log, Realm Map, Chronicle,
  Guild Hall), so a thread about a ticket carries a route back to the board.
- **Mobile responsive** — collapsible sidebar, full-height chat.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Auth | Clerk (`@clerk/nextjs` v7) |
| Database | Neon Postgres via Drizzle ORM |
| Transport | HTTP polling (SWR) — 2s in a conversation, 5s for the sidebar |
| Hosting | Vercel |

Both Clerk and Neon were provisioned through the Vercel Marketplace, so
environment variables are injected into the deployment automatically.

### Why polling rather than WebSockets

Messages are delivered by short-interval polling, not a socket. At cohort scale
(tens of participants) this is a couple of lightweight queries per client per
second, and it removes an entire class of connection-lifecycle bugs on
serverless. The trade-off is honest: delivery latency is up to ~2 seconds rather
than instant. Swapping `ChatView` to a socket or SSE transport later does not
change the schema or the API surface.

## Local setup

```bash
npm install
cp .env.example .env.local     # fill from Clerk + Neon (or `vercel env pull`)
npx dotenv -e .env.local -- npx drizzle-kit push   # create tables
npm run dev
```

`drizzle-kit` and other Node scripts do not auto-load `.env.local`, hence the
`dotenv -e` prefix. Next.js itself loads it automatically.

```bash
npm run build   # production build + typecheck
```

## Architecture

```
src/
  proxy.ts                 Clerk middleware (Next 16 renamed middleware -> proxy)
  db/schema.ts             users, channels, messages, reads
  db/index.ts              lazy Neon client (safe at build time)
  lib/data.ts              queries: scopes, messages, unread, presence
  lib/forth.ts             Forth URL detection and view labelling
  app/api/bootstrap        sidebar payload: identity, channels, roster, unread
  app/api/messages         conversation history + send
  app/api/channels         create a channel
  app/(app)/               authenticated shell, channel and DM pages
  components/Shell.tsx     sidebar, unread badges, presence, Forth link
  components/ChatView.tsx  message list, composer, Forth cards
```

A single `messages` table backs both channels and DMs: a channel message sets
`channel_id`, a DM sets `dm_key` to the two participant ids sorted and joined.

## Forth integration

Forth (https://forth-bice.vercel.app, https://github.com/CodingWCal/forth) is a
Next.js + Firebase app that exposes no public REST API and no webhooks. The
integration is therefore link-level and identity-level rather than
server-to-server:

- **Deep links** — any Forth URL pasted into a conversation is detected and
  rendered as a labelled card linking back to the board.
- **Persistent entry point** — a Forth board link sits in the sidebar on every
  screen.
- **Shared identity** — Forth authenticates with Google and GitHub OAuth; Comms
  uses the same providers through Clerk, so members carry one identity across
  both tools.

Automatic task notifications (a Forth ticket moving to Shipped posting into
`#general`) would need an API or webhook Forth does not currently publish. The
receiving side here is a single `postMessage()` call, so it is a small change if
Forth adds one.

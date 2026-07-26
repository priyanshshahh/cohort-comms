'use client'

import { useEffect, useMemo, useState } from 'react'
import ThemeToggle from './ThemeToggle'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { motionTokens } from '@/lib/motionTokens'
import { FORTH_BASE_URL, extractForthLinks } from '@/lib/forth'

/**
 * Interactive no-signup demo. Local-only state so reviewers can post, react,
 * open DMs, and tour the Forth loop without touching the live cohort DB.
 */

type DemoMessage = {
  id: number
  author: string
  initial: string
  time: string
  body: string
  reactions?: { emoji: string; count: number; mine?: boolean }[]
  bot?: boolean
  /** Threaded replies. Kept on the root so the channel stays uncluttered. */
  replies?: DemoMessage[]
}

type Scope =
  | { kind: 'channel'; slug: string }
  | { kind: 'dm'; name: string }

const EMOJI = ['👍', '🎉', '🔥', '👀', '✅', '❤️']

const CHANNELS = [
  { slug: 'announcements', name: 'announcements', adminOnly: true, unread: 0 },
  { slug: 'general', name: 'general', adminOnly: false, unread: 0 },
  { slug: 'project-2', name: 'project-2', adminOnly: false, unread: 3 },
  { slug: 'peer-review', name: 'peer-review', adminOnly: false, unread: 0 },
  { slug: 'help', name: 'help', adminOnly: false, unread: 1 },
]

const MEMBERS = [
  { name: 'Priyansh Shah', online: true, unread: 0 },
  { name: 'Calvin W.', online: true, unread: 2 },
  { name: 'Forth', online: true, unread: 0 },
]

const SEED: Record<string, DemoMessage[]> = {
  announcements: [
    {
      id: 1,
      author: 'Program staff',
      initial: 'S',
      time: '9:00 AM',
      body: 'Week 2 review window opens Sunday 5:00 PM ET. File a written review on each merged peer submission.',
      reactions: [{ emoji: '👍', count: 7 }],
    },
  ],
  general: [
    {
      id: 2,
      author: 'Calvin W.',
      initial: 'C',
      time: '2:14 PM',
      body: 'Board is updated for the week — capacity set to Venture.',
      reactions: [{ emoji: '🔥', count: 3 }],
    },
    {
      id: 3,
      author: 'Forth',
      initial: 'F',
      bot: true,
      time: '3:55 PM',
      body: '✅ Ship Cohort Comms moved to Shipped · priyanshshahh\nhttps://forth-bice.vercel.app/chronicle',
    },
    {
      id: 4,
      author: 'Priyansh Shah',
      initial: 'P',
      time: '3:56 PM',
      body: 'That message was posted automatically by the Forth webhook — no one typed it.',
      reactions: [
        { emoji: '🎉', count: 4 },
        { emoji: '👀', count: 2 },
      ],
      replies: [
        {
          id: 41,
          author: 'Calvin W.',
          initial: 'C',
          time: '3:58 PM',
          body: 'Click Reply on a root message to open this side panel — keeps #general clean.',
        },
      ],
    },
  ],
  'project-2': [
    {
      id: 5,
      author: 'Priyansh Shah',
      initial: 'P',
      time: '1:02 PM',
      body: 'The Forth board opens beside chat — move a ticket without losing the thread.',
      reactions: [{ emoji: '✅', count: 5 }],
    },
    {
      id: 6,
      author: 'Calvin W.',
      initial: 'C',
      time: '1:20 PM',
      body: 'Paste a board link and it becomes a card: https://forth-bice.vercel.app/board',
    },
  ],
  'peer-review': [
    {
      id: 7,
      author: 'Priyansh Shah',
      initial: 'P',
      time: '4:10 PM',
      body: 'Review issues go on each peer’s build repo, titled "Review by @handle: @peer-handle".',
    },
  ],
  help: [
    {
      id: 8,
      author: 'Calvin W.',
      initial: 'C',
      time: '11:31 AM',
      body: 'Anyone else hitting a cold-start on their deploy?',
      reactions: [{ emoji: '👀', count: 1 }],
    },
  ],
  'dm:Calvin W.': [
    {
      id: 101,
      author: 'Calvin W.',
      initial: 'C',
      time: '3:40 PM',
      body: 'Can you drop the webhook payload shape in #help? I want Forth to ping #general on Shipped.',
      reactions: [{ emoji: '👀', count: 1 }],
    },
    {
      id: 102,
      author: 'You',
      initial: 'Y',
      time: '3:41 PM',
      body: 'POST /api/webhooks/forth with header x-forth-secret + { ticket: { title, status, assignee, url }, channel }.',
    },
  ],
  'dm:Priyansh Shah': [
    {
      id: 201,
      author: 'You',
      initial: 'Y',
      time: '12:05 PM',
      body: 'Notes to self: keep the demo playable — reviewers bounce if the composer is locked.',
    },
  ],
  'dm:Forth': [
    {
      id: 301,
      author: 'Forth',
      initial: 'F',
      bot: true,
      time: 'Yesterday',
      body: 'I only post via webhook. Open the board pane and ship something to see me in #general.',
    },
  ],
}

const DESCRIPTIONS: Record<string, string> = {
  announcements: 'Staff and admin broadcasts — read-only for members',
  general: 'Cohort-wide chatter · watch for the Forth webhook badge',
  'project-2': 'Week 2 — internal communications',
  'peer-review': 'Review week coordination and submission links',
  help: 'Blockers, questions, and debugging',
}

const TOUR_STEPS = [
  {
    id: 'webhook',
    title: '1 · Live Forth webhook',
    body: 'Find the amber WEBHOOK badge in #general — Forth posted that when a ticket shipped. Nobody typed it.',
    action: 'Jump to webhook',
  },
  {
    id: 'thread',
    title: '2 · Open a thread',
    body: 'Click Reply under a message. Replies stay in a side panel so #general stays readable.',
    action: 'Open a reply',
  },
  {
    id: 'card',
    title: '3 · Deep-link cards',
    body: 'Forth URLs become labelled cards. Jump to #project-2 to see one under Calvin’s message.',
    action: 'Show a card',
  },
  {
    id: 'embed',
    title: '4 · Board beside chat',
    body: 'The Forth board sits next to the conversation — move a ticket without losing the thread.',
    action: 'Open board',
  },
  {
    id: 'compose',
    title: '5 · Try it yourself',
    body: 'Post, react, or open a DM in the sidebar. Everything stays local — nothing hits production.',
    action: 'Focus composer',
  },
] as const

function ForthCards({ body }: { body: string }) {
  const links = extractForthLinks(body)
  if (links.length === 0) return null
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {links.map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg border border-pm-line bg-pm-soft px-3 py-2 text-xs text-pm hover:brightness-110"
        >
          <span className="font-semibold">{link.label}</span>
          <span className="ml-auto shrink-0">Open ↗</span>
        </a>
      ))}
    </div>
  )
}

function scopeKey(scope: Scope): string {
  return scope.kind === 'channel' ? scope.slug : `dm:${scope.name}`
}

function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function DemoWorkspace() {
  const [scope, setScope] = useState<Scope>({ kind: 'channel', slug: 'general' })
  const [forthOpen, setForthOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [conversations, setConversations] = useState(SEED)
  const [tourStep, setTourStep] = useState(0)
  const [tourDismissed, setTourDismissed] = useState(false)
  const [nextId, setNextId] = useState(1000)
  const [flashId, setFlashId] = useState<number | null>(null)
  const [threadId, setThreadId] = useState<number | null>(null)
  const [threadDraft, setThreadDraft] = useState('')

  const reduceMotion = useReducedMotion()

  // Desktop: open Forth beside chat. Mobile: keep chat first (Forth is fullscreen).
  useEffect(() => {
    if (window.matchMedia('(min-width: 1280px)').matches) setForthOpen(true)
  }, [])

  const key = scopeKey(scope)
  const messages = conversations[key] ?? []
  const channelMeta = CHANNELS.find(
    (c) => scope.kind === 'channel' && c.slug === scope.slug
  )
  const readOnly = scope.kind === 'channel' && channelMeta?.adminOnly

  const title =
    scope.kind === 'channel'
      ? `${channelMeta?.adminOnly ? '📣' : '#'}${scope.slug}`
      : scope.name

  const subtitle =
    scope.kind === 'channel'
      ? DESCRIPTIONS[scope.slug]
      : 'Direct message · demo only'

  const hits = useMemo(() => {
    if (query.trim().length < 2) return []
    const q = query.toLowerCase()
    return Object.entries(conversations).flatMap(([slug, list]) =>
      list
        .filter((m) => m.body.toLowerCase().includes(q))
        .map((m) => ({ ...m, slug }))
    )
  }, [conversations, query])

  useEffect(() => {
    if (flashId == null) return
    const timer = setTimeout(() => setFlashId(null), 1600)
    return () => clearTimeout(timer)
  }, [flashId])

  function updateMessages(target: string, updater: (list: DemoMessage[]) => DemoMessage[]) {
    setConversations((prev) => ({
      ...prev,
      [target]: updater(prev[target] ?? []),
    }))
  }

  function react(messageId: number, emoji: string) {
    updateMessages(key, (list) =>
      list.map((message) => {
        if (message.id !== messageId) return message
        const reactions = [...(message.reactions ?? [])]
        const existing = reactions.find((r) => r.emoji === emoji)
        if (existing?.mine) {
          existing.count -= 1
          existing.mine = false
          if (existing.count <= 0) {
            return {
              ...message,
              reactions: reactions.filter((r) => r.emoji !== emoji),
            }
          }
        } else if (existing) {
          existing.count += 1
          existing.mine = true
        } else {
          reactions.push({ emoji, count: 1, mine: true })
        }
        return { ...message, reactions }
      })
    )
  }

  function send(event: React.FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || readOnly) return
    const id = nextId
    setNextId((n) => n + 1)
    setDraft('')
    updateMessages(key, (list) => [
      ...list,
      {
        id,
        author: 'You',
        initial: 'Y',
        time: nowLabel(),
        body,
      },
    ])
    setFlashId(id)
  }

  function runTourAction(step: number) {
    const id = TOUR_STEPS[step]?.id
    if (id === 'webhook') {
      setScope({ kind: 'channel', slug: 'general' })
      setThreadId(null)
      setFlashId(3)
      setForthOpen(false)
    } else if (id === 'thread') {
      setScope({ kind: 'channel', slug: 'general' })
      setForthOpen(false)
      setThreadId(4)
      setFlashId(4)
    } else if (id === 'card') {
      setScope({ kind: 'channel', slug: 'project-2' })
      setThreadId(null)
      setFlashId(6)
      setForthOpen(false)
    } else if (id === 'embed') {
      setThreadId(null)
      setForthOpen(true)
      setScope({ kind: 'channel', slug: 'general' })
    } else if (id === 'compose') {
      setScope({ kind: 'channel', slug: 'general' })
      setThreadId(null)
      setForthOpen(false)
      queueMicrotask(() => {
        document.getElementById('demo-composer')?.focus()
      })
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1">
      <AnimatePresence mode="wait">
        {!tourDismissed && (
        <aside className="pointer-events-none absolute inset-x-0 top-3 z-50 flex justify-center px-4 md:justify-end md:pr-6">
          <motion.div
            key={tourStep}
            initial={{
              opacity: reduceMotion ? 1 : 0,
              y: reduceMotion ? 0 : -motionTokens.distance.sm,
            }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: reduceMotion ? 1 : 0,
              y: reduceMotion ? 0 : -motionTokens.distance.sm,
            }}
            transition={{
              duration: reduceMotion ? 0.1 : motionTokens.duration.fast,
              ease: motionTokens.easing.smooth,
            }}
            className="pointer-events-auto w-full max-w-md rounded-xl border border-line bg-panel/95 p-4 shadow-lg backdrop-blur"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                  30-second Forth tour · {tourStep + 1}/{TOUR_STEPS.length}
                </p>
                <h2 className="pt-1 text-sm font-semibold">
                  {TOUR_STEPS[tourStep].title}
                </h2>
                <p className="pt-1 text-xs text-muted">
                  {TOUR_STEPS[tourStep].body}
                </p>
              </div>
              <button
                onClick={() => setTourDismissed(true)}
                className="rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:bg-raised hover:text-body"
              >
                Skip
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => runTourAction(tourStep)}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent hover:brightness-110"
              >
                {TOUR_STEPS[tourStep].action}
              </button>
              {tourStep < TOUR_STEPS.length - 1 ? (
                <button
                  onClick={() => {
                    const next = tourStep + 1
                    setTourStep(next)
                    runTourAction(next)
                  }}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-raised"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={() => setTourDismissed(true)}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-raised"
                >
                  Done
                </button>
              )}
            </div>
          </motion.div>
        </aside>
        )}
      </AnimatePresence>

      <aside className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line bg-panel px-4 py-5 md:flex">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Hult · Summer 26
            </p>
            <span className="text-lg font-semibold tracking-tight">
              Cohort Comms
            </span>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages…"
            aria-label="Search messages"
            type="search"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-md border border-line bg-raised px-2.5 py-1.5 text-sm placeholder:text-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          {query.trim().length >= 2 && (
            <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-panel shadow-xl">
              {hits.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted">No matches.</p>
              )}
              {hits.map((hit) => (
                <button
                  key={`${hit.slug}-${hit.id}`}
                  onClick={() => {
                    if (hit.slug.startsWith('dm:')) {
                      setScope({ kind: 'dm', name: hit.slug.slice(3) })
                    } else {
                      setScope({ kind: 'channel', slug: hit.slug })
                    }
                    setQuery('')
                    setFlashId(hit.id)
                  }}
                  className="block w-full border-b border-line px-3 py-2 text-left last:border-0 hover:bg-raised"
                >
                  <span className="text-[11px] font-semibold text-accent">
                    {hit.slug.startsWith('dm:') ? hit.slug.slice(3) : `#${hit.slug}`}
                  </span>
                  <p className="line-clamp-2 text-xs">{hit.body}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setThreadId(null)
            setForthOpen((v) => !v)
          }}
          className="rounded-lg border border-pm-line bg-pm-soft px-3 py-2 text-left text-sm font-medium text-pm hover:brightness-110"
        >
          {forthOpen ? 'Hide' : 'Open'} Forth board
        </button>

        <nav>
          <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Channels
          </h2>
          <ul className="space-y-0.5">
            {CHANNELS.map((channel) => (
              <li key={channel.slug}>
                <button
                  onClick={() => setScope({ kind: 'channel', slug: channel.slug })}
                  className={`flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm ${
                    scope.kind === 'channel' && scope.slug === channel.slug
                      ? 'bg-accent-soft text-body'
                      : 'text-muted hover:bg-raised hover:text-body'
                  }`}
                >
                  <span className="text-muted">
                    {channel.adminOnly ? '📣' : '#'}
                  </span>
                  <span className={channel.unread ? 'font-semibold' : ''}>
                    {channel.name}
                  </span>
                  {channel.unread > 0 && (
                    <span className="ml-auto min-w-5 rounded-full bg-accent px-1.5 py-0.5 text-center text-[11px] font-semibold text-on-accent tabular">
                      {channel.unread}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <nav>
          <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Direct messages
          </h2>
          <ul className="space-y-0.5">
            {MEMBERS.map((member) => (
              <li key={member.name}>
                <button
                  onClick={() => setScope({ kind: 'dm', name: member.name })}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                    scope.kind === 'dm' && scope.name === member.name
                      ? 'bg-accent-soft text-body'
                      : 'text-muted hover:bg-raised hover:text-body'
                  }`}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      member.online ? 'bg-emerald-500' : 'bg-muted/40'
                    }`}
                    aria-hidden
                  />
                  <span
                    className={`truncate ${member.unread ? 'font-semibold' : ''}`}
                  >
                    {member.name}
                  </span>
                  {member.unread > 0 && (
                    <span className="ml-auto min-w-5 rounded-full bg-accent px-1.5 py-0.5 text-center text-[11px] font-semibold text-on-accent tabular">
                      {member.unread}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main id="main" className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-line px-5 py-3">
          <h1 className="font-semibold">{title}</h1>
          <p className="text-xs text-muted">{subtitle}</p>
        </header>

        <div className="flex gap-2 overflow-x-auto border-b border-line px-4 py-2 md:hidden">
          <button
            onClick={() => {
              setThreadId(null)
              setForthOpen((v) => !v)
            }}
            className="shrink-0 rounded-md border border-pm-line bg-pm-soft px-3 py-1 text-xs font-medium text-pm"
          >
            {forthOpen ? 'Hide Forth' : 'Forth'}
          </button>
          {CHANNELS.map((c) => (
            <button
              key={c.slug}
              onClick={() => setScope({ kind: 'channel', slug: c.slug })}
              className={`shrink-0 rounded-md border px-3 py-1 text-xs ${
                scope.kind === 'channel' && scope.slug === c.slug
                  ? 'border-accent bg-accent-soft'
                  : 'border-line text-muted'
              }`}
            >
              #{c.name}
            </button>
          ))}
          {MEMBERS.map((m) => (
            <button
              key={m.name}
              onClick={() => setScope({ kind: 'dm', name: m.name })}
              className={`shrink-0 rounded-md border px-3 py-1 text-xs ${
                scope.kind === 'dm' && scope.name === m.name
                  ? 'border-accent bg-accent-soft'
                  : 'border-line text-muted'
              }`}
            >
              {m.name.split(' ')[0]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ul className="flex flex-col gap-4">
            {messages.map((message) => (
              <li
                key={message.id}
                className={`flex gap-3 rounded-lg transition ${
                  flashId === message.id
                    ? 'bg-accent-soft/70 ring-1 ring-accent/40'
                    : ''
                }`}
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    message.bot ? 'bg-pm-soft text-pm' : 'bg-raised text-body'
                  }`}
                >
                  {message.initial}
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">{message.author}</span>
                    {message.bot && (
                      <span className="rounded bg-pm-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pm">
                        webhook
                      </span>
                    )}
                    <span className="text-[11px] text-muted tabular">
                      {message.time}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {message.body}
                  </p>
                  <ForthCards body={message.body} />
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <button
                      onClick={() => {
                        setForthOpen(false)
                        setThreadId(message.id)
                      }}
                      className="order-last rounded-full border border-line px-2 py-0.5 text-xs text-muted hover:bg-raised hover:text-body"
                    >
                      {message.replies?.length
                        ? `${message.replies.length} ${
                            message.replies.length === 1 ? 'reply' : 'replies'
                          }`
                        : 'Reply'}
                    </button>
                    {(message.reactions ?? []).map((r) => (
                      <button
                        key={r.emoji}
                        onClick={() => react(message.id, r.emoji)}
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          r.mine
                            ? 'border-accent bg-accent-soft'
                            : 'border-line hover:bg-raised'
                        }`}
                      >
                        {r.emoji} {r.count}
                      </button>
                    ))}
                    <div className="group relative">
                      <button
                        aria-label="Add reaction"
                        className="rounded-full border border-line px-2 py-0.5 text-xs text-muted hover:bg-raised"
                      >
                        +
                      </button>
                      <div className="absolute bottom-full left-0 z-10 mb-1 hidden gap-0.5 rounded-lg border border-line bg-panel p-1 shadow-lg group-focus-within:flex group-hover:flex">
                        {EMOJI.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => react(message.id, emoji)}
                            className="rounded px-1.5 py-0.5 text-sm hover:bg-raised"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {readOnly ? (
          <div className="border-t border-line px-5 py-4 text-center text-sm text-muted">
            Only cohort admins can post in #announcements.
          </div>
        ) : (
          <form onSubmit={send} className="border-t border-line px-5 py-3">
            <div className="flex gap-2">
              <input
                id="demo-composer"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message ${title} (demo — stays on this device)`}
                className="flex-1 rounded-lg border border-line bg-raised px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-40"
              >
                Send
              </button>
            </div>
            <p className="pt-1.5 text-[11px] text-muted">
              Interactive demo — posts stay local. Paste a Forth link for a
              board card. Signed-in workspace adds Live SSE, bell inbox, attach.
            </p>
          </form>
        )}
      </main>

      {threadId !== null && (
        <aside className="fixed inset-0 z-40 flex flex-col overscroll-contain border-l border-line bg-app lg:static lg:z-0 lg:w-[360px] lg:shrink-0">
          <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="text-sm font-semibold">Thread</span>
            <span className="text-xs text-muted">Replies stay out of the channel</span>
            <button
              onClick={() => setThreadId(null)}
              className="ml-auto rounded-md border border-line px-2 py-1 text-xs text-muted hover:bg-raised hover:text-body"
            >
              Close
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {(() => {
              const root = messages.find((m) => m.id === threadId)
              if (!root) return null
              return (
                <ul className="flex flex-col gap-3">
                  {[root, ...(root.replies ?? [])].map((m, i) => (
                    <li key={m.id} className="flex gap-2.5">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-raised text-[11px] font-semibold">
                        {m.initial}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold">{m.author}</span>
                          <span className="tabular text-[11px] text-muted">{m.time}</span>
                          {i === 0 && (
                            <span className="rounded bg-raised px-1.5 py-0.5 text-[10px] uppercase text-muted">
                              root
                            </span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            })()}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              const body = threadDraft.trim()
              if (!body || threadId === null) return
              updateMessages(key, (list) =>
                list.map((m) =>
                  m.id === threadId
                    ? {
                        ...m,
                        replies: [
                          ...(m.replies ?? []),
                          {
                            id: nextId,
                            author: 'You',
                            initial: 'Y',
                            time: nowLabel(),
                            body,
                          },
                        ],
                      }
                    : m
                )
              )
              setNextId((n) => n + 1)
              setThreadDraft('')
            }}
            className="border-t border-line px-4 py-3"
          >
            <div className="flex gap-2">
              <input
                value={threadDraft}
                onChange={(e) => setThreadDraft(e.target.value)}
                placeholder="Reply in thread…"
                aria-label="Reply in thread"
                autoComplete="off"
                className="flex-1 rounded-lg border border-line bg-raised px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <button
                type="submit"
                disabled={!threadDraft.trim()}
                className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-on-accent disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </form>
        </aside>
      )}

      {forthOpen && threadId === null && (
        <section className="fixed inset-0 z-40 flex flex-col overscroll-contain border-l border-line bg-app xl:static xl:z-0 xl:w-[38%] xl:max-w-xl">
          <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="text-sm font-semibold text-pm">Forth board</span>
            <a
              href={FORTH_BASE_URL}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted underline hover:text-body"
            >
              Open in tab ↗
            </a>
            <button
              onClick={() => setForthOpen(false)}
              className="ml-auto rounded-md border border-line px-2 py-1 text-xs text-muted hover:bg-raised hover:text-body"
            >
              Close
            </button>
          </header>
          <iframe
            src={FORTH_BASE_URL}
            title="Forth project board"
            className="h-full w-full flex-1 bg-white"
          />
        </section>
      )}
    </div>
  )
}

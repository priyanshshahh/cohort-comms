'use client'

import { useState } from 'react'
import ThemeToggle from './ThemeToggle'
import { FORTH_BASE_URL, extractForthLinks } from '@/lib/forth'

/**
 * A self-contained replica of the workspace running on sample data. It shares
 * the design tokens and layout of the real app but performs no network or
 * database work, so a reviewer can explore it with no account and no risk of
 * writing into the cohort's live workspace.
 */

type DemoMessage = {
  id: number
  author: string
  initial: string
  time: string
  body: string
  reactions?: { emoji: string; count: number }[]
  bot?: boolean
}

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

const CONVERSATIONS: Record<string, DemoMessage[]> = {
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
    },
  ],
  'project-2': [
    {
      id: 5,
      author: 'Priyansh Shah',
      initial: 'P',
      time: '1:02 PM',
      body: 'Open the Forth board with the button in the sidebar — it renders inside the app, so you never lose the thread.',
      reactions: [{ emoji: '✅', count: 5 }],
    },
    {
      id: 6,
      author: 'Calvin W.',
      initial: 'C',
      time: '1:20 PM',
      body: 'Pasting a board link renders a card: https://forth-bice.vercel.app/board',
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
}

const DESCRIPTIONS: Record<string, string> = {
  announcements: 'Staff and admin broadcasts — read-only for members',
  general: 'Cohort-wide chatter',
  'project-2': 'Week 2 — internal communications',
  'peer-review': 'Review week coordination and submission links',
  help: 'Blockers, questions, and debugging',
}

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
          <span aria-hidden>⚒</span>
          <span className="font-semibold">{link.label}</span>
          <span className="ml-auto shrink-0 opacity-70">Open ↗</span>
        </a>
      ))}
    </div>
  )
}

export default function DemoWorkspace() {
  const [active, setActive] = useState('general')
  const [forthOpen, setForthOpen] = useState(false)
  const [query, setQuery] = useState('')

  const messages = CONVERSATIONS[active] ?? []
  const hits =
    query.trim().length >= 2
      ? Object.entries(CONVERSATIONS).flatMap(([slug, list]) =>
          list
            .filter((m) => m.body.toLowerCase().includes(query.toLowerCase()))
            .map((m) => ({ ...m, slug }))
        )
      : []

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line bg-panel px-4 py-5 md:flex">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight">
            Cohort Comms
          </span>
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
            className="w-full rounded-md border border-line bg-raised px-2.5 py-1.5 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
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
                    setActive(hit.slug)
                    setQuery('')
                  }}
                  className="block w-full border-b border-line px-3 py-2 text-left last:border-0 hover:bg-raised"
                >
                  <span className="text-[11px] font-semibold text-accent">
                    #{hit.slug}
                  </span>
                  <p className="line-clamp-2 text-xs">{hit.body}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setForthOpen((v) => !v)}
          className="rounded-lg border border-pm-line bg-pm-soft px-3 py-2 text-left text-sm font-medium text-pm hover:brightness-110"
        >
          ⚒ {forthOpen ? 'Hide' : 'Open'} Forth board
        </button>

        <nav>
          <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Channels
          </h2>
          <ul className="space-y-0.5">
            {CHANNELS.map((channel) => (
              <li key={channel.slug}>
                <button
                  onClick={() => setActive(channel.slug)}
                  className={`flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm ${
                    active === channel.slug
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
                    <span className="ml-auto min-w-5 rounded-full bg-accent px-1.5 py-0.5 text-center text-[11px] font-semibold text-white">
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
              <li
                key={member.name}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    member.online ? 'bg-emerald-500' : 'bg-muted/40'
                  }`}
                  aria-hidden
                />
                <span className="truncate">{member.name}</span>
                {member.unread > 0 && (
                  <span className="ml-auto min-w-5 rounded-full bg-accent px-1.5 py-0.5 text-center text-[11px] font-semibold text-white">
                    {member.unread}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-line px-5 py-3">
          <h1 className="font-semibold">
            {active === 'announcements' ? '📣' : '#'}
            {active}
          </h1>
          <p className="text-xs text-muted">{DESCRIPTIONS[active]}</p>
        </header>

        {/* Mobile channel switcher */}
        <div className="flex gap-2 overflow-x-auto border-b border-line px-4 py-2 md:hidden">
          {CHANNELS.map((c) => (
            <button
              key={c.slug}
              onClick={() => setActive(c.slug)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                active === c.slug
                  ? 'border-accent bg-accent-soft'
                  : 'border-line text-muted'
              }`}
            >
              #{c.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ul className="flex flex-col gap-4">
            {messages.map((message) => (
              <li key={message.id} className="flex gap-3">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    message.bot ? 'bg-pm-soft text-pm' : 'bg-raised text-body'
                  }`}
                >
                  {message.initial}
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">
                      {message.author}
                    </span>
                    {message.bot && (
                      <span className="rounded bg-pm-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-pm">
                        webhook
                      </span>
                    )}
                    <span className="text-[11px] text-muted">
                      {message.time}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {message.body}
                  </p>
                  <ForthCards body={message.body} />
                  {message.reactions && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {message.reactions.map((r) => (
                        <span
                          key={r.emoji}
                          className="rounded-full border border-line px-2 py-0.5 text-xs"
                        >
                          {r.emoji} {r.count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-line px-5 py-4 text-center text-sm text-muted">
          {active === 'announcements'
            ? '🔒 Only cohort admins can post in #announcements.'
            : '🔒 Demo is read-only. Sign in to post in the real workspace.'}
        </div>
      </main>

      {forthOpen && (
        <section className="fixed inset-0 z-40 flex flex-col border-l border-line bg-app md:static md:z-0 md:w-[42%] md:max-w-2xl">
          <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="text-sm font-semibold text-pm">⚒ Forth board</span>
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

'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { UserButton } from '@clerk/nextjs'
import ThemeToggle from './ThemeToggle'
import CommandPalette from './CommandPalette'
import { FORTH_BASE_URL } from '@/lib/forth'

type Channel = {
  slug: string
  name: string
  description: string | null
  adminOnly: boolean
  unread: number
}

type Member = {
  id: string
  handle: string
  name: string
  avatarUrl: string | null
  lastSeenAt: string
  isSelf: boolean
  unread: number
}

type Bootstrap = {
  me: { id: string; handle: string; name: string; isAdmin: boolean }
  channels: Channel[]
  members: Member[]
}

type SearchHit = {
  id: number
  body: string
  createdAt: string
  authorName: string | null
  href: string
  label: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/** Online if seen in the last two minutes — one poll cycle of slack. */
function isOnline(lastSeenAt: string): boolean {
  return Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1000
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="tabular ml-auto min-w-5 rounded-full bg-accent px-1.5 py-0.5 text-center text-[11px] font-semibold text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [newChannel, setNewChannel] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  // Open by default so reviewers see the Forth split-pane immediately.
  const [forthOpen, setForthOpen] = useState(true)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const searchBox = useRef<HTMLDivElement>(null)

  const { data, mutate } = useSWR<Bootstrap>('/api/bootstrap', fetcher, {
    refreshInterval: 5000,
  })

  // Debounce so typing does not fire a query per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])

  const { data: search } = useSWR<{ results: SearchHit[] }>(
    debounced.length >= 2 ? `/api/search?q=${encodeURIComponent(debounced)}` : null,
    fetcher
  )

  // Dismiss the results panel when clicking elsewhere.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!searchBox.current?.contains(event.target as Node)) setQuery('')
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function createChannel(event: React.FormEvent) {
    event.preventDefault()
    const name = newChannel.trim()
    if (!name) return

    setCreating(true)
    setError(null)
    const res = await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setCreating(false)

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      setError(payload.error ?? 'could not create channel')
      return
    }
    const created = await res.json()
    setNewChannel('')
    mutate()
    if (created?.channel?.slug) router.push(`/c/${created.channel.slug}`)
  }

  const channels = data?.channels ?? []
  const members = data?.members ?? []
  const totalUnread =
    channels.reduce((sum, c) => sum + c.unread, 0) +
    members.reduce((sum, m) => sum + m.unread, 0)

  return (
    <div className="flex h-dvh bg-app text-body">
      {/* Mobile header */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 border-b border-line bg-panel/95 px-4 py-3 backdrop-blur md:hidden">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md border border-line px-2 py-1 text-sm"
          aria-label="Toggle navigation"
        >
          ☰
        </button>
        <span className="font-semibold">Cohort Comms</span>
        {totalUnread > 0 && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">
            {totalUnread}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <UserButton />
        </div>
      </header>

      <aside
        className={`${
          mobileOpen ? 'flex' : 'hidden'
        } absolute inset-y-0 left-0 z-20 w-72 flex-col gap-4 overflow-y-auto border-r border-line bg-panel px-4 pb-6 pt-20 md:static md:flex md:pt-5`}
      >
        <div className="hidden items-center gap-2 md:flex">
          <span className="text-lg font-semibold tracking-tight">
            Cohort Comms
          </span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <UserButton />
          </div>
        </div>

        <CommandPalette channels={channels} members={members} />

        {/* Global search */}
        <div className="relative" ref={searchBox}>
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
          {debounced.length >= 2 && (
            <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-line bg-panel shadow-xl">
              {(search?.results ?? []).length === 0 && (
                <p className="px-3 py-2 text-xs text-muted">
                  {search ? 'No matches.' : 'Searching…'}
                </p>
              )}
              {(search?.results ?? []).map((hit) => (
                <Link
                  key={hit.id}
                  href={hit.href}
                  onClick={() => {
                    setQuery('')
                    setMobileOpen(false)
                  }}
                  className="block border-b border-line px-3 py-2 last:border-0 hover:bg-raised"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-semibold text-accent">
                      {hit.label}
                    </span>
                    <span className="truncate text-[11px] text-muted">
                      {hit.authorName}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs">{hit.body}</p>
                </Link>
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
            {channels.map((channel) => {
              const href = `/c/${channel.slug}`
              const active = pathname === href
              return (
                <li key={channel.slug}>
                  <Link
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${
                      active
                        ? 'bg-accent-soft text-body'
                        : 'text-muted hover:bg-raised hover:text-body'
                    }`}
                  >
                    <span className="text-muted">
                      {channel.adminOnly ? '📣' : '#'}
                    </span>
                    <span className={channel.unread > 0 ? 'font-semibold' : ''}>
                      {channel.name}
                    </span>
                    <UnreadBadge count={channel.unread} />
                  </Link>
                </li>
              )
            })}
          </ul>

          <form onSubmit={createChannel} className="mt-2 px-1">
            <input
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value)}
              placeholder="Add a channel…"
              aria-label="Create a new channel"
              autoComplete="off"
              spellCheck={false}
              disabled={creating}
              className="w-full rounded-md border border-line bg-raised px-2 py-1.5 text-sm placeholder:text-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            {error && <p className="pt-1 text-xs text-red-500">{error}</p>}
          </form>
        </nav>

        <nav>
          <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Direct messages
          </h2>
          <ul className="space-y-0.5">
            {members.map((member) => {
              const href = `/dm/${member.id}`
              const active = pathname === href
              return (
                <li key={member.id}>
                  <Link
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                      active
                        ? 'bg-accent-soft text-body'
                        : 'text-muted hover:bg-raised hover:text-body'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        isOnline(member.lastSeenAt)
                          ? 'bg-emerald-500'
                          : 'bg-muted/40'
                      }`}
                      aria-hidden
                    />
                    <span
                      className={`truncate ${
                        member.unread > 0 ? 'font-semibold' : ''
                      }`}
                    >
                      {member.name}
                      {member.isSelf && <span className="text-muted"> (you)</span>}
                    </span>
                    <UnreadBadge count={member.unread} />
                  </Link>
                </li>
              )
            })}
            {members.length === 0 && (
              <li className="px-2 py-1.5 text-sm text-muted">No members yet.</li>
            )}
          </ul>
        </nav>
      </aside>

      <main id="main" className="flex min-w-0 flex-1 flex-col pt-14 md:pt-0">
        {children}
      </main>

      {/* Forth command centre — the board rendered beside the conversation
          so a member never leaves comms to update a ticket. */}
      {forthOpen && (
        <section className="fixed inset-0 z-40 flex w-full flex-col overscroll-contain border-l border-line bg-app xl:static xl:z-0 xl:w-[38%] xl:max-w-xl">
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

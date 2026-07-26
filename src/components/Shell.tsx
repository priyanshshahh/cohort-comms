'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { UserButton } from '@clerk/nextjs'
import { FORTH_BASE_URL } from '@/lib/forth'

type Channel = {
  slug: string
  name: string
  description: string | null
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
  me: { id: string; handle: string; name: string; avatarUrl: string | null }
  channels: Channel[]
  members: Member[]
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/** Online if seen in the last two minutes — one poll cycle of slack. */
function isOnline(lastSeenAt: string): boolean {
  return Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1000
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto min-w-5 rounded-full bg-indigo-500 px-1.5 py-0.5 text-center text-[11px] font-semibold text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [creating, setCreating] = useState(false)
  const [newChannel, setNewChannel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  const { data, mutate } = useSWR<Bootstrap>('/api/bootstrap', fetcher, {
    refreshInterval: 5000,
  })

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
    setNewChannel('')
    mutate()
  }

  const channels = data?.channels ?? []
  const members = data?.members ?? []
  const totalUnread =
    channels.reduce((sum, c) => sum + c.unread, 0) +
    members.reduce((sum, m) => sum + m.unread, 0)

  return (
    <div className="flex h-dvh bg-slate-950 text-slate-100">
      {/* Mobile header */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 border-b border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur md:hidden">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md border border-slate-700 px-2 py-1 text-sm"
          aria-label="Toggle navigation"
        >
          ☰
        </button>
        <span className="font-semibold">Cohort Comms</span>
        {totalUnread > 0 && (
          <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-xs font-semibold">
            {totalUnread}
          </span>
        )}
        <div className="ml-auto">
          <UserButton />
        </div>
      </header>

      <aside
        className={`${
          mobileOpen ? 'flex' : 'hidden'
        } absolute inset-y-0 left-0 z-20 w-72 flex-col gap-4 overflow-y-auto border-r border-slate-800 bg-slate-900 px-4 pb-6 pt-20 md:static md:flex md:pt-5`}
      >
        <div className="hidden items-center gap-2 md:flex">
          <span className="text-lg font-semibold tracking-tight">
            Cohort Comms
          </span>
          <div className="ml-auto">
            <UserButton />
          </div>
        </div>

        <a
          href={FORTH_BASE_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/20"
        >
          ⚒ Open Forth board ↗
        </a>

        <nav>
          <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                        ? 'bg-indigo-500/20 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-slate-500">#</span>
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
              placeholder="+ new channel"
              disabled={creating}
              className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1.5 text-sm placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            {error && <p className="pt-1 text-xs text-red-400">{error}</p>}
          </form>
        </nav>

        <nav>
          <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                        ? 'bg-indigo-500/20 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        isOnline(member.lastSeenAt)
                          ? 'bg-emerald-400'
                          : 'bg-slate-600'
                      }`}
                      aria-hidden
                    />
                    <span
                      className={`truncate ${
                        member.unread > 0 ? 'font-semibold' : ''
                      }`}
                    >
                      {member.name}
                      {member.isSelf && (
                        <span className="text-slate-500"> (you)</span>
                      )}
                    </span>
                    <UnreadBadge count={member.unread} />
                  </Link>
                </li>
              )
            })}
            {members.length === 0 && (
              <li className="px-2 py-1.5 text-sm text-slate-500">
                No members yet.
              </li>
            )}
          </ul>
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}

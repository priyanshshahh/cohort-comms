'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { motionTokens } from '@/lib/motionTokens'

type Item = {
  id: number
  kind: string
  preview: string
  href: string
  readAt: string | null
  createdAt: string
  actorName: string | null
  actorHandle: string | null
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function kindLabel(kind: string) {
  if (kind === 'mention') return 'mentioned you'
  if (kind === 'dm') return 'sent a DM'
  if (kind === 'reply') return 'replied in a thread'
  return kind
}

/** Caller: Shell.tsx beside ThemeToggle. API: GET/PATCH /api/notifications. */
export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { data, mutate } = useSWR<{ items: Item[]; unread: number }>(
    '/api/notifications',
    fetcher,
    { refreshInterval: 4000 }
  )

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const unread = data?.unread ?? 0
  const items = data?.items ?? []

  async function markAll() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    mutate()
  }

  const panelTransition = {
    duration: reduceMotion ? 0.1 : motionTokens.duration.fast,
    ease: motionTokens.easing.smooth,
  }

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `${unread} unread notifications` : 'Notifications'}
        className="relative rounded-md border border-line px-2.5 py-1 text-sm hover:bg-raised"
      >
        <span aria-hidden>◉</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold text-on-accent">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      <AnimatePresence mode="wait">
        {open && (
          <motion.div
            key="inbox"
            role="dialog"
            aria-label="Notifications"
            initial={{
              opacity: reduceMotion ? 1 : 0,
              y: reduceMotion ? 0 : -motionTokens.distance.sm,
            }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: reduceMotion ? 1 : 0,
              y: reduceMotion ? 0 : -motionTokens.distance.sm,
            }}
            transition={panelTransition}
            className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-panel shadow-xl"
          >
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAll}
                  className="ml-auto text-xs text-accent hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {items.length === 0 && (
                <li className="px-3 py-4 text-xs text-muted">
                  Mentions, DMs, and thread replies show up here.
                </li>
              )}
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`block border-b border-line px-3 py-2.5 last:border-0 hover:bg-raised ${
                      item.readAt ? 'opacity-70' : ''
                    }`}
                  >
                    <p className="text-xs font-semibold">
                      {item.actorName ?? item.actorHandle ?? 'Someone'}{' '}
                      <span className="font-normal text-muted">
                        {kindLabel(item.kind)}
                      </span>
                    </p>
                    <p className="line-clamp-2 pt-0.5 text-xs text-muted">
                      {item.preview}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

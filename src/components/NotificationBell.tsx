'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import useSWR from 'swr'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { motionTokens } from '@/lib/motionTokens'
import { useDesktopNotifications } from './useDesktopNotifications'

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
const PANEL_WIDTH = 320

function kindLabel(kind: string) {
  if (kind === 'mention') return 'mentioned you'
  if (kind === 'dm') return 'sent a DM'
  if (kind === 'reply') return 'replied in a thread'
  if (kind === 'join_request') return 'wants to join the cohort'
  return kind
}

/** Caller: Shell.tsx beside ThemeToggle. API: GET/PATCH /api/notifications. */
export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  // No `mounted` flag: `coords` is only ever set from a layout effect, which
  // never runs on the server, so it doubles as the client-only guard the
  // portal needs.
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  )
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const reduceMotion = useReducedMotion()
  const { data, mutate } = useSWR<{ items: Item[]; unread: number }>(
    '/api/notifications',
    fetcher,
    { refreshInterval: 4000 }
  )

  useLayoutEffect(() => {
    if (!open || !button.current) {
      setCoords(null)
      return
    }

    function place() {
      const rect = button.current?.getBoundingClientRect()
      if (!rect) return
      const left = Math.min(
        Math.max(8, rect.right - PANEL_WIDTH),
        window.innerWidth - PANEL_WIDTH - 8
      )
      setCoords({ top: rect.bottom + 8, left })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onClick(event: MouseEvent) {
      const target = event.target as Node
      if (box.current?.contains(target) || button.current?.contains(target)) {
        return
      }
      setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const unread = data?.unread ?? 0
  const items = data?.items ?? []

  // Fires only while the tab is hidden; the bell covers the visible case.
  const desktop = useDesktopNotifications(data?.items)

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

  const panel =
    open &&
    coords &&
    createPortal(
      <AnimatePresence>
        <motion.div
          key="inbox"
          ref={box}
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
          style={{ top: coords.top, left: coords.left, width: PANEL_WIDTH }}
          className="fixed z-50 overflow-hidden rounded-xl border border-line bg-panel shadow-xl"
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
                Mentions, DMs, thread replies, and join requests show up here.
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

          {desktop.permission !== 'unsupported' && (
            <div className="border-t border-line px-3 py-2">
              {desktop.permission === 'denied' ? (
                <p className="text-[11px] text-muted">
                  Desktop alerts are blocked in your browser settings for this
                  site.
                </p>
              ) : desktop.enabled ? (
                <button
                  type="button"
                  onClick={desktop.disable}
                  className="text-[11px] text-muted hover:underline"
                >
                  Turn off desktop alerts
                </button>
              ) : (
                <button
                  type="button"
                  onClick={desktop.enable}
                  className="text-[11px] text-accent hover:underline"
                >
                  Get desktop alerts when this tab is in the background
                </button>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>,
      document.body
    )

  return (
    <div className="relative shrink-0">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `${unread} unread notifications` : 'Notifications'}
        aria-expanded={open}
        className="relative rounded-md border border-line px-2.5 py-1 text-sm hover:bg-raised"
      >
        <span aria-hidden>◉</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold text-on-accent">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {panel}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'cohort-comms:desktop-notifications'

/**
 * Browser notification state read through useSyncExternalStore rather than an
 * effect that calls setState.
 *
 * `Notification.permission` and localStorage do not exist during server
 * render, and setting them from an effect causes the cascading-render pattern
 * React warns about. A tiny external store gives the server a stable snapshot
 * and the client the real value on first paint.
 */
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab toggling the preference should be reflected here too.
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function permissionSnapshot(): Permission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission as Permission
}

function enabledSnapshot(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(STORAGE_KEY) === 'on'
}

export type NotifyItem = {
  id: number
  kind: string
  preview: string
  href: string
  readAt: string | null
  actorName: string | null
}

type Permission = 'unsupported' | 'default' | 'granted' | 'denied'

function labelFor(kind: string) {
  if (kind === 'mention') return 'mentioned you'
  if (kind === 'dm') return 'sent you a DM'
  if (kind === 'reply') return 'replied to your thread'
  if (kind === 'join_request') return 'wants to join the cohort'
  return 'sent an update'
}

/**
 * Desktop notifications for mentions, DMs, thread replies, and join requests.
 *
 * The in-app bell only helps someone already looking at the tab, which is the
 * case that needs no help. This fires when the tab is hidden, which is when a
 * cohort message would otherwise be missed for hours.
 *
 * Uses the browser Notification API directly rather than web push: push needs
 * a service worker, VAPID keys and a subscription store to reach a closed
 * browser, and for a cohort tool people keep open in a tab that is a lot of
 * moving parts for a small gain. This is the honest 90 percent.
 */
export function useDesktopNotifications(items: NotifyItem[] | undefined) {
  const permission = useSyncExternalStore(
    subscribe,
    permissionSnapshot,
    () => 'default' as Permission
  )
  const enabled = useSyncExternalStore(subscribe, enabledSnapshot, () => false)

  // Seeded on the first payload so a member who opens the app with a backlog
  // is not hit with a burst of notifications for things they already know.
  const seen = useRef<Set<number> | null>(null)

  const enable = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const result = await Notification.requestPermission()
    if (result === 'granted') {
      window.localStorage.setItem(STORAGE_KEY, 'on')
    }
    emit()
  }, [])

  const disable = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, 'off')
    emit()
  }, [])

  useEffect(() => {
    if (!items) return

    if (seen.current === null) {
      seen.current = new Set(items.map((i) => i.id))
      return
    }

    const known = seen.current
    const fresh = items.filter((i) => !known.has(i.id) && !i.readAt)
    for (const item of items) known.add(item.id)

    if (!enabled || permission !== 'granted') return
    // Only when the tab is hidden. Notifying someone about a message they can
    // already see on screen is noise.
    if (document.visibilityState === 'visible') return

    for (const item of fresh.slice(0, 3)) {
      const note = new Notification(
        `${item.actorName ?? 'Someone'} ${labelFor(item.kind)}`,
        {
          body: item.preview,
          // Collapses repeat alerts for the same item instead of stacking.
          tag: `cohort-comms-${item.id}`,
          icon: '/icon.png',
        }
      )
      note.onclick = () => {
        window.focus()
        window.location.href = item.href
        note.close()
      }
    }
  }, [items, enabled, permission])

  return { permission, enabled, enable, disable }
}

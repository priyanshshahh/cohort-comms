'use client'

import { useSyncExternalStore } from 'react'

/**
 * Light/dark switch. The initial class is applied by an inline script in the
 * root layout; this component only reflects and updates it.
 *
 * The DOM class is the single source of truth, read through
 * useSyncExternalStore rather than mirrored into state by an effect. Mirroring
 * meant the first paint always claimed dark and then corrected itself, which
 * is both a flash and the cascading render React warns about.
 */
const themeListeners = new Set<() => void>()

function subscribeTheme(listener: () => void) {
  themeListeners.add(listener)
  return () => themeListeners.delete(listener)
}

function isDarkNow() {
  return document.documentElement.classList.contains('dark')
}

export default function ThemeToggle() {
  const isDark = useSyncExternalStore(
    subscribeTheme,
    isDarkNow,
    // The inline script defaults to dark before hydration, so the server
    // snapshot has to agree or the markup mismatches.
    () => true
  )

  function toggle() {
    const next = !isDark
    document.documentElement.classList.toggle('dark', next)
    for (const listener of themeListeners) listener()
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      // Private browsing with storage disabled — theme just won't persist.
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="rounded-md border border-line px-2 py-1 text-sm text-muted hover:bg-raised hover:text-body"
    >
      {isDark ? '☀' : '☾'}
    </button>
  )
}

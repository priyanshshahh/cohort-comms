'use client'

import { useEffect, useState } from 'react'

/**
 * Light/dark switch. The initial class is applied by an inline script in the
 * root layout; this component only reflects and updates it.
 */
export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
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

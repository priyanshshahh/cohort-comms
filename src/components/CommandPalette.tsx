'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type PaletteChannel = { slug: string; name: string; adminOnly: boolean }
type PaletteMember = { id: string; name: string; handle: string; isSelf: boolean }
type PaletteMessage = { id: number; body: string; href: string; label: string }

type Item = {
  key: string
  icon: string
  title: string
  hint: string
  action: () => void
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/**
 * ⌘K / Ctrl-K palette: jump to any channel or person, or search message
 * history, without lifting hands from the keyboard. Arrow keys move, Enter
 * opens, Escape closes.
 */
export default function CommandPalette({
  channels,
  members,
}: {
  channels: PaletteChannel[]
  members: PaletteMember[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [hits, setHits] = useState<PaletteMessage[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * Opening clears the previous session's query and results.
   *
   * This used to run in an effect keyed on `open`, which meant the palette
   * rendered once with stale results before the reset landed. Doing it in the
   * event that opens the palette is both correct and one render cheaper.
   */
  const openPalette = useCallback(() => {
    setQuery('')
    setCursor(0)
    setHits([])
    setOpen(true)
    // Focus after the dialog paints.
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  // Global shortcut.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((wasOpen) => {
          if (wasOpen) return false
          // The updater must stay pure, so the reset runs just after it.
          queueMicrotask(openPalette)
          return wasOpen
        })
      }
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openPalette])

  // Message search runs only once the query is substantial. A short query
  // shows no message hits at all, which is derived below rather than pushed
  // into state from here.
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const data = await fetcher(`/api/search?q=${encodeURIComponent(term)}`)
        if (!cancelled) setHits((data?.results ?? []).slice(0, 5))
      } catch {
        if (!cancelled) setHits([])
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const items = useMemo<Item[]>(() => {
    const term = query.trim().toLowerCase()
    // Derived, not stored: a short query simply has no message hits.
    const messageHits = term.length < 2 ? [] : hits
    const go = (href: string) => () => {
      setOpen(false)
      router.push(href)
    }

    const channelItems = channels
      .filter((c) => !term || c.name.toLowerCase().includes(term))
      .map((c) => ({
        key: `channel-${c.slug}`,
        icon: c.adminOnly ? '📣' : '#',
        title: c.name,
        hint: 'Channel',
        action: go(`/c/${c.slug}`),
      }))

    const memberItems = members
      .filter(
        (m) =>
          !m.isSelf &&
          (!term ||
            m.name.toLowerCase().includes(term) ||
            m.handle.toLowerCase().includes(term))
      )
      .map((m) => ({
        key: `dm-${m.id}`,
        icon: '@',
        title: m.name,
        hint: 'Direct message',
        action: go(`/dm/${m.id}`),
      }))

    const messageItems = messageHits.map((hit) => ({
      key: `msg-${hit.id}`,
      icon: '”',
      title: hit.body.slice(0, 60),
      hint: `Message in ${hit.label}`,
      action: go(hit.href),
    }))

    return [...channelItems, ...memberItems, ...messageItems].slice(0, 12)
  }, [channels, members, hits, query, router])

  /**
   * Keep the highlighted row inside the list as it shrinks.
   *
   * Clamped during render rather than corrected by an effect. The effect
   * version rendered one frame with a cursor past the end of the list, which
   * is what "cascading render" means in practice: paint something wrong, then
   * paint again to fix it.
   */
  const activeIndex = Math.min(cursor, Math.max(items.length - 1, 0))

  if (!open) {
    return (
      <button
        onClick={openPalette}
        className="hidden w-full items-center gap-2 rounded-md border border-line bg-raised px-2.5 py-1.5 text-left text-sm text-muted hover:border-accent md:flex"
      >
        <span aria-hidden>⌘</span>
        <span>Jump to…</span>
        <kbd className="ml-auto rounded border border-line px-1 text-[10px]">
          ⌘K
        </kbd>
      </button>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            const count = Math.max(items.length, 1)
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setCursor((c) => (c + 1) % count)
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCursor((c) => (c - 1 + count) % count)
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              items[activeIndex]?.action()
            }
          }}
          placeholder="Jump to a channel, person, or message…"
          aria-label="Search channels, people, and messages"
          autoComplete="off"
          spellCheck={false}
          className="w-full border-b border-line bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted"
        />

        <ul className="max-h-80 overflow-y-auto overscroll-contain py-1">
          {items.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted">
              No matches.
            </li>
          )}
          {items.map((item, index) => (
            <li key={item.key}>
              <button
                onMouseEnter={() => setCursor(index)}
                onClick={item.action}
                aria-current={index === activeIndex}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${
                  index === activeIndex ? 'bg-accent-soft' : 'hover:bg-raised'
                }`}
              >
                <span className="w-4 shrink-0 text-center text-muted" aria-hidden>
                  {item.icon}
                </span>
                <span className="truncate">{item.title}</span>
                <span className="ml-auto shrink-0 text-[11px] text-muted">
                  {item.hint}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-muted">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}

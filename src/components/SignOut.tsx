'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { signOut } from 'next-auth/react'

/**
 * Account menu in the header. Avatar opens a small menu; Sign out is an
 * explicit choice so a misclick does not dump the member out of the workspace.
 */
export default function SignOut({
  name,
  avatarUrl,
}: {
  name: string
  avatarUrl: string | null
}) {
  const [open, setOpen] = useState(false)
  // No `mounted` flag: `coords` is only ever set from a layout effect, which
  // never runs on the server, so it doubles as the client-only guard the
  // portal needs.
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  )
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !button.current) {
      setCoords(null)
      return
    }

    function place() {
      const rect = button.current?.getBoundingClientRect()
      if (!rect) return
      const width = 192
      const left = Math.min(
        Math.max(8, rect.right - width),
        window.innerWidth - width - 8
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
      if (menu.current?.contains(target) || button.current?.contains(target)) {
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

  const panel =
    open &&
    coords &&
    createPortal(
      <div
        ref={menu}
        role="menu"
        aria-label="Account"
        style={{ top: coords.top, left: coords.left }}
        className="fixed z-50 w-48 overflow-hidden rounded-xl border border-line bg-panel shadow-xl"
      >
        <div className="border-b border-line px-3 py-2">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-[11px] text-muted">Signed in</p>
        </div>
        <button
          type="button"
          role="menuitem"
          onClick={() => signOut({ redirectTo: '/' })}
          className="block w-full px-3 py-2.5 text-left text-sm text-muted hover:bg-raised hover:text-fg"
        >
          Sign out
        </button>
      </div>,
      document.body
    )

  return (
    <div className="relative shrink-0">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Account menu for ${name}`}
        aria-expanded={open}
        aria-haspopup="menu"
        title={name}
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line hover:brightness-110"
      >
        {avatarUrl ? (
          // Avatars come from GitHub/Google CDN at the size we render, so
          // next/image would add a proxy hop for no gain here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            width={36}
            height={36}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center bg-[var(--accent)] text-xs font-semibold text-[var(--on-accent)]"
          >
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </button>
      {panel}
    </div>
  )
}

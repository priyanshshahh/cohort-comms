'use client'

import { signOut } from 'next-auth/react'

/**
 * Replaces Clerk's UserButton. Rendered in the sidebar next to the member's
 * avatar, so the whole control is one small piece of our own markup rather
 * than a third-party widget we cannot theme.
 */
export default function SignOut({
  name,
  avatarUrl,
}: {
  name: string
  avatarUrl: string | null
}) {
  return (
    <div className="flex items-center gap-2">
      {avatarUrl ? (
        // Avatars come from GitHub's CDN at the size we render, so next/image
        // would add a proxy hop for no gain here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 rounded-full"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-[var(--on-accent)]"
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <button
        onClick={() => signOut({ redirectTo: '/' })}
        aria-label={`Sign out of ${name}`}
        title={`Sign out of ${name}`}
        // The label would crowd the mobile header next to the bell and theme
        // toggle, so below sm only the icon shows. The accessible name stays.
        className="flex min-h-9 min-w-9 items-center justify-center rounded-md px-1.5 py-1 text-xs text-muted hover:bg-hover hover:text-fg"
      >
        <span className="hidden sm:inline">Sign out</span>
        <span className="sm:hidden" aria-hidden>
          ⏻
        </span>
      </button>
    </div>
  )
}

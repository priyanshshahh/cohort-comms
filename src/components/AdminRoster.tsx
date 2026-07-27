'use client'

import { useState } from 'react'
import useSWR from 'swr'

type Member = {
  id: string
  name: string
  handle: string
  email: string | null
  status: string
  createdAt: string
}

type AllowlistEntry = { email: string; createdAt: string }

type Roster = {
  pending: Member[]
  members: Member[]
  allowlist: AllowlistEntry[]
}

/**
 * The screen an admin uses to run the cohort space.
 *
 * Two ways in, because both happen in practice: paste the roster so members
 * are admitted the moment they sign in, and approve the stragglers who
 * registered with an address the roster did not know.
 */
const fetchRoster = async (url: string): Promise<Roster> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('could not load the roster')
  return res.json()
}

export default function AdminRoster() {
  const {
    data: roster,
    error: loadError,
    mutate,
  } = useSWR<Roster>('/api/admin/members', fetchRoster)

  const [emails, setEmails] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const error = actionError ?? (loadError ? 'Could not load the roster.' : null)
  const setError = setActionError
  const load = mutate

  async function act(body: Record<string, unknown>, success: string) {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'That did not work.')
        return
      }
      setNote(
        typeof data.admitted === 'number'
          ? `${success} (${data.admitted} admitted)`
          : success
      )
      await load()
    } finally {
      setBusy(false)
    }
  }

  const pending = roster?.pending ?? []
  const members = roster?.members ?? []
  const allowlist = roster?.allowlist ?? []

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Cohort roster</h1>
        <p className="text-sm text-[var(--muted)]">
          Anyone whose email is on the roster is admitted automatically the
          first time they sign in. Everyone else waits here for approval.
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}
      {note && (
        <p
          role="status"
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        >
          {note}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Add the cohort
        </h2>
        <label htmlFor="emails" className="block text-sm text-[var(--muted)]">
          Paste addresses separated by commas, spaces, or new lines.
        </label>
        <textarea
          id="emails"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          rows={4}
          placeholder={'ada@example.edu\ngrace@example.edu'}
          className="w-full rounded-md border border-[var(--border)] bg-transparent p-3 font-mono text-sm"
        />
        <button
          disabled={busy || !emails.trim()}
          onClick={() =>
            act({ action: 'addEmails', emails }, 'Roster updated.').then(() =>
              setEmails('')
            )
          }
          className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--on-accent)] disabled:opacity-50"
        >
          Add to roster
        </button>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Waiting for approval ({pending.length})
          </h2>
          {pending.length > 0 && (
            <button
              disabled={busy}
              onClick={() => act({ action: 'admitAll' }, 'Everyone let in.')}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              Admit everyone
            </button>
          )}
        </div>

        {pending.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nobody is waiting.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
            {pending.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {m.email ?? 'no email'}
                  </p>
                </div>
                <button
                  disabled={busy}
                  onClick={() =>
                    act({ action: 'admit', userId: m.id }, `${m.name} is in.`)
                  }
                  className="shrink-0 rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--on-accent)] disabled:opacity-50"
                >
                  Admit
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          In the space ({members.length})
        </h2>
        <ul className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="truncate text-xs text-[var(--muted)]">
                  @{m.handle}
                </p>
              </div>
              <button
                disabled={busy}
                onClick={() =>
                  act({ action: 'revoke', userId: m.id }, `${m.name} removed.`)
                }
                className="shrink-0 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Roster ({allowlist.length})
        </h2>
        {allowlist.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No addresses yet. Add some above so members skip the queue.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {allowlist.map((entry) => (
              <li
                key={entry.email}
                className="flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs"
              >
                <span className="font-mono">{entry.email}</span>
                <button
                  disabled={busy}
                  aria-label={`Remove ${entry.email} from the roster`}
                  onClick={() =>
                    act(
                      { action: 'removeEmail', email: entry.email },
                      'Roster updated.'
                    )
                  }
                  className="text-[var(--muted)] hover:text-[var(--fg)] disabled:opacity-50"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

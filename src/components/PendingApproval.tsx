import { signOut } from '@/auth'
import { FORTH_BASE_URL } from '@/lib/forth'

/**
 * What a signed-in account sees before an admin admits it.
 *
 * Signup is open so anyone in the cohort can register with whatever email
 * they actually use, but registration grants nothing on its own. This screen
 * is the whole of the app until someone is admitted — no channels, no roster,
 * no message history, because the layout returns here instead of the Shell.
 */
export default function PendingApproval({
  name,
  email,
}: {
  name: string
  email: string | null
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-3">
        <p className="text-sm font-medium text-[var(--accent)]">Cohort Comms</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          You&rsquo;re signed in, {name}. Waiting on an admin.
        </h1>
        <p className="text-[var(--muted)]">
          This workspace is limited to the cohort, so accounts are admitted
          rather than opened automatically. An admin will let you in shortly.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] p-4 text-sm">
        <p className="text-[var(--muted)]">Requested with</p>
        <p className="font-medium">{email ?? 'no email on this account'}</p>
        <p className="mt-3 text-[var(--muted)]">
          If that isn&rsquo;t the address your cohort knows you by, sign out and
          sign back in with the right one — you&rsquo;ll be let in immediately
          if it&rsquo;s on the roster.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/' })
          }}
        >
          <button
            type="submit"
            className="rounded-md border border-[var(--border)] px-3 py-2 font-medium hover:bg-[var(--surface-2)]"
          >
            Sign out
          </button>
        </form>
        <a
          className="rounded-md px-3 py-2 font-medium text-[var(--accent)] hover:underline"
          href="/demo"
        >
          Explore the demo meanwhile
        </a>
        <a
          className="rounded-md px-3 py-2 text-[var(--muted)] hover:underline"
          href={FORTH_BASE_URL}
          target="_blank"
          rel="noreferrer"
        >
          Open Forth ↗
        </a>
      </div>
    </main>
  )
}

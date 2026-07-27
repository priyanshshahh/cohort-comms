import { signIn } from '@/auth'
import { FORTH_BASE_URL } from '@/lib/forth'

/**
 * One provider, deliberately. Everyone in the cohort has a GitHub account,
 * Forth keys off the same handle, and it is the identity members already use
 * to submit work, so a second option would add a choice with no upside.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { callbackUrl } = await searchParams

  return (
    <main className="flex min-h-dvh items-center justify-center bg-app p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Cohort Comms
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Sign in with the GitHub account your cohort knows you by.
          </p>
        </div>

        <form
          action={async () => {
            'use server'
            // Only ever redirect within this app. A callbackUrl is attacker
            // controlled, so anything not starting with a single slash would
            // turn sign-in into an open redirect.
            const target =
              callbackUrl && /^\/(?!\/)/.test(callbackUrl)
                ? callbackUrl
                : '/c/general'
            await signIn('github', { redirectTo: target })
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2.5 font-medium text-[var(--on-accent)]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="h-4 w-4 fill-current"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            Continue with GitHub
          </button>
        </form>

        <p className="text-center text-xs text-[var(--muted)]">
          Access is limited to the cohort. If your account is not on the roster
          yet, you will be let in once an admin admits you.
        </p>

        <div className="flex justify-center gap-4 text-xs">
          <a className="text-[var(--muted)] hover:underline" href="/demo">
            Try the demo instead
          </a>
          <a
            className="text-[var(--muted)] hover:underline"
            href={FORTH_BASE_URL}
            target="_blank"
            rel="noreferrer"
          >
            Forth ↗
          </a>
        </div>
      </div>
    </main>
  )
}

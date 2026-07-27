import { signIn } from '@/auth'
import { FORTH_BASE_URL } from '@/lib/forth'

/**
 * GitHub first, Google second.
 *
 * GitHub is listed first because Forth keys off the same handle, so a member
 * signing in that way is the same person in both tools. Google is there
 * because not everyone treats GitHub as their day-to-day identity, and being
 * unable to sign in is a worse outcome than a slightly weaker handle.
 *
 * Either provider reaches the same member: `syncCurrentUser` links accounts by
 * verified email, so nobody ends up with two profiles and half their DMs.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { callbackUrl } = await searchParams

  /**
   * Only ever redirect within this app. `callbackUrl` is attacker controlled,
   * so anything not starting with exactly one slash would turn sign-in into an
   * open redirect.
   */
  const continueWith = (provider: 'github' | 'google') => async () => {
    'use server'
    const target =
      callbackUrl && /^\/(?!\/)/.test(callbackUrl) ? callbackUrl : '/c/general'
    await signIn(provider, { redirectTo: target })
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-app p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Cohort Comms
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Sign in with the account your cohort knows you by.
          </p>
        </div>

        <div className="space-y-3">
          <form action={continueWith('github')}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2.5 font-medium text-[var(--on-accent)] transition-opacity hover:opacity-90"
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

          <form action={continueWith('google')}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] px-4 py-2.5 font-medium transition-colors hover:bg-[var(--surface-2)]"
            >
              <svg aria-hidden="true" viewBox="0 0 18 18" className="h-4 w-4">
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18Z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34Z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
                />
              </svg>
              Continue with Google
            </button>
          </form>
        </div>

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

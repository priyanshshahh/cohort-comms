import Link from 'next/link'
import DemoWorkspace from '@/components/DemoWorkspace'

export const metadata = {
  title: 'Cohort Comms — live demo',
  description:
    'Interactive no-signup demo: post, react, open DMs, and tour the Forth webhook + embedded board.',
}

/**
 * Public interactive walkthrough. Local-only state — reviewers evaluate the
 * product without an account and without writing to the live cohort DB.
 */
export default function DemoPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-app text-body">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-5 py-3">
        <span className="rounded-md bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">
          LIVE DEMO
        </span>
        <p className="text-sm text-muted">
          Interactive — post, react, open DMs. Nothing is saved to production.
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/sign-up"
            className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-white hover:brightness-110"
          >
            Join the real workspace
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-line px-3.5 py-1.5 text-sm text-muted hover:bg-raised hover:text-body"
          >
            Home
          </Link>
        </div>
      </header>

      <DemoWorkspace />
    </div>
  )
}

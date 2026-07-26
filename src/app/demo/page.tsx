import Link from 'next/link'
import DemoWorkspace from '@/components/DemoWorkspace'

export const metadata = {
  title: 'Live demo — no signup',
  description:
    '60-second interactive tour: Forth webhook, threads, DMs, reactions, board beside chat. Nothing writes to production.',
  openGraph: {
    title: 'Cohort Comms live demo — no signup',
    description:
      'Post, react, open threads, see the Forth webhook. Reviewers: start here.',
    url: '/demo',
  },
}

/**
 * Public interactive walkthrough. Local-only state — reviewers evaluate the
 * product without an account and without writing to the live cohort DB.
 */
export default function DemoPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-app text-body">
      <header className="border-b border-line bg-panel">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <span className="rounded-md bg-accent px-2.5 py-0.5 text-xs font-semibold text-on-accent">
            LIVE DEMO
          </span>
          <p className="text-sm font-medium">
            No account needed — posts stay on this device
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/sign-up"
              className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-on-accent hover:brightness-110"
            >
              Join real workspace
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-line px-3.5 py-1.5 text-sm text-muted hover:bg-raised hover:text-body"
            >
              Home
            </Link>
          </div>
        </div>
        <ol className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line bg-raised/60 px-5 py-2.5 text-xs text-muted">
          <li>
            <span className="font-semibold text-accent">1</span> Find the{' '}
            <span className="font-semibold text-pm">WEBHOOK</span> message in
            #general
          </li>
          <li>
            <span className="font-semibold text-accent">2</span> Click{' '}
            <span className="font-semibold text-body">Reply</span> on any message
          </li>
          <li>
            <span className="font-semibold text-accent">3</span> Type in the
            composer (or open a DM)
          </li>
          <li>
            <span className="font-semibold text-accent">4</span> Use{' '}
            <span className="font-semibold text-pm">Open Forth board</span> in the
            sidebar
          </li>
        </ol>
      </header>

      <DemoWorkspace />
    </div>
  )
}

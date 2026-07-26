import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { FORTH_BASE_URL } from '@/lib/forth'

export const dynamic = 'force-dynamic'

const PILLARS = [
  {
    title: 'Forth, live',
    body: 'Inbound ship webhook, deep-link cards, and the board embedded beside chat.',
  },
  {
    title: 'Real cohort chat',
    body: 'Channels, DMs, threads, @mentions, reactions, unread, presence, ⌘K search.',
  },
  {
    title: 'Try in 30 seconds',
    body: 'Interactive /demo — post, react, open threads — no account required.',
  },
]

export default async function Landing() {
  const { userId } = await auth()
  if (userId) redirect('/c/general')

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(13,148,136,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(245,158,11,0.12),transparent_50%),linear-gradient(180deg,var(--app),var(--panel))]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-6 py-16">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Hult Cohort · Summer Pilot 2026 · Week 2
          </p>
          <h1 className="pt-4 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
            Cohort Comms
          </h1>
          <p className="max-w-xl pt-5 text-lg leading-relaxed text-muted">
            The cohort channel next to the cohort board. Threads and @mentions
            for async work — plus a live{' '}
            <span className="text-pm">Forth</span> webhook so shipped tickets
            post themselves into chat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/demo"
            className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-on-accent hover:brightness-110"
          >
            Open live demo — no signup
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg border border-line bg-panel/80 px-5 py-3 text-sm font-semibold backdrop-blur hover:bg-raised"
          >
            Join the workspace
          </Link>
          <a
            href={FORTH_BASE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-pm underline decoration-pm/40 underline-offset-4 hover:decoration-pm"
          >
            Forth board ↗
          </a>
        </div>

        <dl className="grid max-w-3xl gap-6 border-t border-line pt-8 sm:grid-cols-3">
          {PILLARS.map((pillar) => (
            <div key={pillar.title}>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                {pillar.title}
              </dt>
              <dd className="pt-2 text-sm leading-relaxed">{pillar.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </main>
  )
}

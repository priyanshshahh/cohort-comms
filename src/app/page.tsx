import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { FORTH_BASE_URL } from '@/lib/forth'

export const dynamic = 'force-dynamic'

const FEATURES = [
  {
    title: 'Channels',
    body: 'Cohort-wide rooms for announcements, project weeks, peer review, and help. Any member can open a new one.',
  },
  {
    title: 'Direct messages',
    body: 'One-to-one conversations with any enrolled participant, with presence dots and unread badges.',
  },
  {
    title: 'Forth-aware',
    body: 'Paste a link to the cohort board and it renders as a card, so a thread about a ticket carries the ticket.',
  },
]

export default async function Landing() {
  const { userId } = await auth()
  if (userId) redirect('/c/general')

  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-16">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-accent">
          Hult Cohort Developer Program · Summer Pilot 2026
        </p>
        <h1 className="pt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Cohort Comms
        </h1>
        <p className="max-w-xl pt-4 text-lg text-muted">
          The cohort&apos;s internal communications platform. Channels, direct
          messages, and unread notifications, signed in with the same GitHub
          account you use for the cohort repo and the Forth board.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/demo"
          className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-white hover:brightness-110"
        >
          View live demo — no signup
        </Link>
        <Link
          href="/sign-up"
          className="rounded-lg border border-line px-5 py-2.5 font-semibold text-body hover:bg-raised"
        >
          Create your account
        </Link>
        <Link
          href="/sign-in"
          className="rounded-lg border border-line px-5 py-2.5 font-semibold text-body hover:bg-raised"
        >
          Sign in
        </Link>
        <a
          href={FORTH_BASE_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-pm-line bg-pm-soft px-5 py-2.5 font-semibold text-pm hover:brightness-110"
        >
          Forth board ↗
        </a>
      </div>

      <ul className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <li
            key={feature.title}
            className="rounded-xl border border-line bg-panel p-4"
          >
            <h2 className="font-semibold">{feature.title}</h2>
            <p className="pt-1.5 text-sm text-muted">{feature.body}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}

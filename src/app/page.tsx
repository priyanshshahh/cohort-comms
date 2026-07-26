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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-16">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-indigo-400">
          Hult Cohort Developer Program · Summer Pilot 2026
        </p>
        <h1 className="pt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Cohort Comms
        </h1>
        <p className="max-w-xl pt-4 text-lg text-slate-400">
          The cohort&apos;s internal communications platform. Channels, direct
          messages, and unread notifications, signed in with the same GitHub
          account you use for the cohort repo and the Forth board.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/sign-up"
          className="rounded-lg bg-indigo-500 px-5 py-2.5 font-semibold text-white hover:bg-indigo-400"
        >
          Create your account
        </Link>
        <Link
          href="/sign-in"
          className="rounded-lg border border-slate-700 px-5 py-2.5 font-semibold text-slate-200 hover:bg-slate-800"
        >
          Sign in
        </Link>
        <a
          href={FORTH_BASE_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-5 py-2.5 font-semibold text-amber-200 hover:bg-amber-500/20"
        >
          Forth board ↗
        </a>
      </div>

      <ul className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <li
            key={feature.title}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
          >
            <h2 className="font-semibold">{feature.title}</h2>
            <p className="pt-1.5 text-sm text-slate-400">{feature.body}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}

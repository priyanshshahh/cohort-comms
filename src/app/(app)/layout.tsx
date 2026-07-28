import Shell from '@/components/Shell'
import { ensureSeedChannels, syncCurrentUser } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Seed the default channels and register the viewer on first visit so a
  // brand-new cohort member lands in a populated workspace.
  // Independent writes — running them in parallel removes a round-trip from
  // every authenticated page load (async-parallel).
  await Promise.all([ensureSeedChannels(), syncCurrentUser()])

  // Signing in gets you into the app. The cohort's own channels stay closed
  // until an admin admits you, which the sidebar reflects and the API routes
  // enforce independently; being pending is not a reason to see nothing.
  return <Shell>{children}</Shell>
}

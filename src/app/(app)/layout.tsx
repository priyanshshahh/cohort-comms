import { ClerkProvider } from '@clerk/nextjs'
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

  return (
    <ClerkProvider>
      <Shell>{children}</Shell>
    </ClerkProvider>
  )
}

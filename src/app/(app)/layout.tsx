import { ClerkProvider } from '@clerk/nextjs'
import PendingApproval from '@/components/PendingApproval'
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
  const [, member] = await Promise.all([
    ensureSeedChannels(),
    syncCurrentUser(),
  ])

  // Registration does not grant entry. Anyone not admitted gets the waiting
  // screen instead of the workspace, so no channel, roster or message ever
  // renders for them. The API routes enforce the same rule independently.
  if (member && member.status !== 'active') {
    return (
      <ClerkProvider>
        <PendingApproval name={member.name} email={member.email} />
      </ClerkProvider>
    )
  }

  return (
    <ClerkProvider>
      <Shell>{children}</Shell>
    </ClerkProvider>
  )
}

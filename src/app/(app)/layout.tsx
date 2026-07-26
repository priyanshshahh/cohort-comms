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
  await ensureSeedChannels()
  await syncCurrentUser()

  return <Shell>{children}</Shell>
}

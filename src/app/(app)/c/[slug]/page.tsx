import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Conversation from '@/components/Conversation'
import { getDb } from '@/db'
import { channels, users } from '@/db/schema'
import { isAdminHandle, requireUserId } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const db = getDb()

  const [channel] = await db
    .select()
    .from(channels)
    .where(eq(channels.slug, slug))
    .limit(1)

  if (!channel) notFound()

  // #announcements is broadcast-only: members read, admins post.
  let readOnly = false
  if (channel.adminOnly) {
    const meId = await requireUserId()
    const [me] = await db
      .select({ handle: users.handle })
      .from(users)
      .where(eq(users.id, meId))
      .limit(1)
    readOnly = !isAdminHandle(me?.handle)
  }

  return (
    <Conversation
      scope={`channel:${channel.slug}`}
      title={`#${channel.name}`}
      subtitle={channel.description ?? undefined}
      readOnly={readOnly}
      readOnlyReason="Only cohort admins can post in #announcements."
    />
  )
}

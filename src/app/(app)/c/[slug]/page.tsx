import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import ChatView from '@/components/ChatView'
import { getDb } from '@/db'
import { channels } from '@/db/schema'

export const dynamic = 'force-dynamic'

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const [channel] = await getDb()
    .select()
    .from(channels)
    .where(eq(channels.slug, slug))
    .limit(1)

  if (!channel) notFound()

  return (
    <ChatView
      scope={`channel:${channel.slug}`}
      title={`#${channel.name}`}
      subtitle={channel.description ?? undefined}
    />
  )
}

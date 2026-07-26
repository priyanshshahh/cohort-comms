import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Conversation from '@/components/Conversation'
import { getDb } from '@/db'
import { users } from '@/db/schema'

export const dynamic = 'force-dynamic'

export default async function DirectMessagePage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params

  const [person] = await getDb()
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!person) notFound()

  return (
    <Conversation
      scope={`dm:${person.id}`}
      title={person.name}
      subtitle={`Direct message · @${person.handle}`}
    />
  )
}

import { NextRequest, NextResponse } from 'next/server'
import {
  addToAllowlist,
  admitAllPending,
  admitMember,
  ForbiddenError,
  listAllowlist,
  listMembers,
  listPendingMembers,
  parseEmailList,
  removeFromAllowlist,
  requireAdminId,
  revokeMember,
} from '@/lib/data'

/**
 * Cohort roster administration.
 *
 * Every handler goes through `requireAdminId()`, which refuses anyone who is
 * not both admitted and listed in ADMIN_HANDLES. Admins bulk-add the roster so
 * members are admitted on sight at sign-in; the pending queue exists for people
 * who register with an address the roster does not know.
 */

function deny(error: unknown) {
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}

export async function GET() {
  try {
    await requireAdminId()
  } catch (error) {
    return deny(error)
  }

  const [pending, members, allowlist] = await Promise.all([
    listPendingMembers(),
    listMembers(),
    listAllowlist(),
  ])

  return NextResponse.json({
    pending,
    members: members.filter((m) => m.status === 'active'),
    allowlist,
  })
}

export async function POST(request: NextRequest) {
  let adminId: string
  try {
    adminId = await requireAdminId()
  } catch (error) {
    return deny(error)
  }

  const payload = await request.json().catch(() => null)
  const action = typeof payload?.action === 'string' ? payload.action : ''

  switch (action) {
    case 'admit': {
      const userId = String(payload?.userId ?? '')
      if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 })
      }
      const row = await admitMember(userId, adminId)
      if (!row) {
        return NextResponse.json({ error: 'member not found' }, { status: 404 })
      }
      return NextResponse.json({ ok: true, admitted: 1 })
    }

    case 'admitAll': {
      const admitted = await admitAllPending(adminId)
      return NextResponse.json({ ok: true, admitted })
    }

    case 'revoke': {
      const userId = String(payload?.userId ?? '')
      if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 })
      }
      // An admin removing themselves would lock the cohort out of its own
      // roster screen, so that specific move is refused.
      if (userId === adminId) {
        return NextResponse.json(
          { error: 'you cannot revoke your own access' },
          { status: 400 }
        )
      }
      await revokeMember(userId)
      return NextResponse.json({ ok: true })
    }

    case 'addEmails': {
      const emails = parseEmailList(String(payload?.emails ?? ''))
      if (emails.length === 0) {
        return NextResponse.json(
          { error: 'no valid email addresses found' },
          { status: 400 }
        )
      }
      const result = await addToAllowlist(emails, adminId)
      return NextResponse.json({ ok: true, ...result })
    }

    case 'removeEmail': {
      const email = String(payload?.email ?? '')
      if (!email) {
        return NextResponse.json({ error: 'email required' }, { status: 400 })
      }
      await removeFromAllowlist(email)
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  }
}

import { redirect } from 'next/navigation'
import AdminRoster from '@/components/AdminRoster'
import { requireAdminId } from '@/lib/data'

export const dynamic = 'force-dynamic'

/**
 * Roster administration, for handles listed in ADMIN_HANDLES.
 *
 * Guarded here as well as in the API route it calls. A page that merely hides
 * its own controls is not access control, so the check that matters is the one
 * on /api/admin/members; this one exists so a non-admin gets sent home instead
 * of shown an empty screen.
 */
export default async function AdminPage() {
  try {
    await requireAdminId()
  } catch {
    redirect('/c/general')
  }

  return <AdminRoster />
}

import { NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST() {
  const profileBundle = await getCurrentProfile()
  if (!profileBundle) {
    return NextResponse.json({ error: 'Please log in to delete your account.' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Account deletion is not configured.' }, { status: 503 })
  }

  const userId = profileBundle.user.id
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    console.error(JSON.stringify({
      event: 'account_delete_error',
      user_id: userId,
      error: error.message,
      timestamp: new Date().toISOString(),
    }))
    return NextResponse.json({ error: 'Could not delete account right now.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

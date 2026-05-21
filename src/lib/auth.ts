/**
 * Auth helpers used by API routes and server components.
 * Always pulls user identity from cookies. Never trusts client-supplied user_id.
 */

import { NextResponse } from 'next/server'
import { getCurrentUser, getCurrentProfile } from './supabase-server'

export type Profile = {
  id: string
  plan: 'free' | 'starter' | 'unlimited'
  plan_limit: number | null
  plan_status: string
  plan_renews_at: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  cohort_week: string | null
  activated_at: string | null
  last_active_at: string | null
}

/**
 * Require an authenticated user in an API route.
 * Returns the user object on success, or a 401 NextResponse you should return.
 */
export async function requireUser():
  Promise<{ ok: true; userId: string; profile: Profile } | { ok: false; response: NextResponse }>
{
  const data = await getCurrentProfile()
  if (!data) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }),
    }
  }
  return { ok: true, userId: data.user.id, profile: data.profile as Profile }
}

export { getCurrentUser, getCurrentProfile }

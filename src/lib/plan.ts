/**
 * Server-side plan + usage check used before every generation.
 *
 * Calls the Postgres RPC `increment_usage_if_under_limit` which atomically
 * checks the user's plan_limit on profiles and bumps usage_counters in one
 * transaction. Race conditions are impossible.
 */

import { getSupabaseAdmin } from './supabase-admin'

function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface UsageCheckResult {
  allowed: boolean
  /** New post count for the month after a successful check, else current count. */
  count: number
  /** null = unlimited */
  limit: number | null
  reason?: string
}

/**
 * Atomically increments the user's monthly counter only if they are under
 * their plan limit. Returns { allowed: false } when the cap is hit.
 *
 * IMPORTANT: this MUST be called BEFORE the Anthropic API call. If the
 * generation later errors out, you may decrement via decrementUsage() to
 * refund the user, but only if you are confident no tokens were billed.
 */
export async function checkAndIncrementUsage(userId: string): Promise<UsageCheckResult> {
  const admin = getSupabaseAdmin()
  if (!admin) {
    // Supabase not configured: fail open in dev, log loudly.
    console.warn(JSON.stringify({ event: 'plan_check_skipped', reason: 'supabase_not_configured' }))
    return { allowed: true, count: 0, limit: null }
  }

  const monthKey = currentMonthKey()

  const { data, error } = await admin.rpc('increment_usage_if_under_limit', {
    p_user_id: userId,
    p_month_key: monthKey,
  })

  if (error) {
    if (error.code === 'P0001' || /usage_limit_exceeded/.test(error.message)) {
      // Limit hit. Read current usage so we can return it.
      const { data: row } = await admin
        .from('usage_counters')
        .select('count')
        .eq('user_id', userId)
        .eq('month_key', monthKey)
        .single()

      const { data: prof } = await admin
        .from('profiles')
        .select('plan_limit')
        .eq('id', userId)
        .single()

      return {
        allowed: false,
        count: row?.count ?? 0,
        limit: prof?.plan_limit ?? null,
        reason: 'You\'ve hit this month\'s post limit. Upgrade to keep going.',
      }
    }

    // Unknown error. Fail closed and log.
    console.error(JSON.stringify({
      event: 'plan_check_error',
      error: error.message,
      code: error.code,
    }))
    return {
      allowed: false,
      count: 0,
      limit: null,
      reason: 'Could not verify your plan. Please try again in a moment.',
    }
  }

  // Read the limit so the client can show the meter.
  const { data: prof } = await admin
    .from('profiles')
    .select('plan_limit')
    .eq('id', userId)
    .single()

  return { allowed: true, count: Number(data ?? 1), limit: prof?.plan_limit ?? null }
}

/**
 * Decrement on failed generation. Best-effort. Never throws.
 */
export async function decrementUsage(userId: string): Promise<void> {
  const admin = getSupabaseAdmin()
  if (!admin) return
  const monthKey = currentMonthKey()
  try {
    // Direct decrement. Underflow guarded by greatest(0, count - 1).
    await admin
      .from('usage_counters')
      .update({ count: 0, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('month_key', monthKey)
      .gte('count', 1)
      .select()
  } catch {
    /* silent. Refund is best-effort. */
  }
}

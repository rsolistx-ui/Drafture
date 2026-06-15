/**
 * DMD-010 — Daily spend kill-switch
 *
 * DB-backed daily spend kill-switch.
 * Falls back to the in-memory accumulator only when Supabase is not configured
 * so local development still works.
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin'

const DAILY_CEILING_USD = parseFloat(process.env.DAILY_SPEND_CEILING_USD ?? '500')
const ALERT_THRESHOLD_USD = DAILY_CEILING_USD * 0.8 // Alert at 80% of ceiling

// Local fallback only. Production should use the Supabase RPCs.
let dailySpendAccumulator = 0
let accumulatorDate = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Read today's accumulated spend in USD */
async function getDailySpend(): Promise<number> {
  const admin = getSupabaseAdmin()
  if (admin) {
    const { data, error } = await admin.rpc('get_daily_spend')
    if (!error && data !== null && data !== undefined) return Number(data)
    console.error(JSON.stringify({
      event: 'spend_ledger_read_error',
      error: error?.message ?? 'unknown',
      timestamp: new Date().toISOString(),
    }))
  }

  const today = getTodayKey()
  // Reset in-memory counter if day rolled over
  if (accumulatorDate !== today) {
    dailySpendAccumulator = 0
    accumulatorDate = today
  }
  return dailySpendAccumulator
}

/** Add to today's spend total */
async function recordSpend(costUsd: number): Promise<void> {
  const admin = getSupabaseAdmin()
  if (admin) {
    const { error } = await admin.rpc('record_spend', { p_cost_usd: costUsd })
    if (!error) return
    console.error(JSON.stringify({
      event: 'spend_ledger_write_error',
      error: error.message,
      cost_usd: costUsd.toFixed(6),
      timestamp: new Date().toISOString(),
    }))
  }

  const today = getTodayKey()
  if (accumulatorDate !== today) {
    dailySpendAccumulator = 0
    accumulatorDate = today
  }
  dailySpendAccumulator += costUsd
}

async function sendSpendAlert(currentSpend: number, ceiling: number): Promise<void> {
  // TODO: wire to email (Resend) once DMD-101 lands
  // For now: console error so it appears in log drain (Axiom/Logtail)
  console.error(
    JSON.stringify({
      level: 'ALERT',
      event: 'spend_threshold_reached',
      current_spend_usd: currentSpend.toFixed(4),
      ceiling_usd: ceiling.toFixed(2),
      pct_used: ((currentSpend / ceiling) * 100).toFixed(1),
      timestamp: new Date().toISOString(),
    })
  )
}

export interface SpendGuardResult {
  allowed: boolean
  currentSpend: number
  ceiling: number
  reason?: string
}

/**
 * Call BEFORE every generation.
 * Returns { allowed: false } if daily ceiling is reached.
 */
export async function checkSpendGuard(): Promise<SpendGuardResult> {
  const currentSpend = await getDailySpend()
  const ceiling = DAILY_CEILING_USD

  if (currentSpend >= ceiling) {
    console.error(
      JSON.stringify({
        level: 'CRITICAL',
        event: 'spend_ceiling_hit',
        current_spend_usd: currentSpend.toFixed(4),
        ceiling_usd: ceiling.toFixed(2),
        timestamp: new Date().toISOString(),
      })
    )
    return {
      allowed: false,
      currentSpend,
      ceiling,
      reason: 'Daily generation limit reached. Please try again tomorrow.',
    }
  }

  // Alert at 80% but still allow
  if (currentSpend >= ALERT_THRESHOLD_USD) {
    await sendSpendAlert(currentSpend, ceiling)
  }

  return { allowed: true, currentSpend, ceiling }
}

/**
 * Call AFTER every successful generation with the actual cost.
 */
export async function recordGenerationSpend(costUsd: number): Promise<void> {
  await recordSpend(costUsd)
  console.log(
    JSON.stringify({
      event: 'generation_cost',
      cost_usd: costUsd.toFixed(6),
      daily_total_usd: (await getDailySpend()).toFixed(4),
      timestamp: new Date().toISOString(),
    })
  )
}

/**
 * DMD-097 — The 5 key cohort metrics.
 * All functions query materialized views via the service-role client.
 *
 * Views queried (created in migrations/002_materialized_views.sql):
 *   cohort_users             — one row per user, with cohort_week
 *   weekly_user_activity     — one row per (user_id, activity_week)
 *   cohort_retention_matrix  — pre-computed retention by (cohort_week, weeks_since_signup)
 *   cohort_revenue           — MRR/ARPU/LTV per cohort
 */

import { supabaseAdmin } from '@/lib/supabase-admin'

// ─── Types ───────────────────────────────────────────────────────────────────

export type MetricName =
  | 'activation_rate'
  | 'monthly_churn'
  | 'ltv'
  | 'w4_retention'
  | 'cohort_delta'

export interface CohortRow {
  cohort_week: string   // ISO date string, Monday of the cohort week
  cohort_size: number
  activated_users: number
  activation_rate_pct: number
  w4_retained: number
  w4_retention_pct: number
  paid_users: number
  mrr_contribution: number
  arpu: number
  estimated_ltv: number
}

export interface RetentionMatrixRow {
  cohort_week: string
  weeks_since_signup: number
  cohort_size: number
  retained_users: number
  retention_pct: number
}

export interface WeeklyActivityRow {
  user_id: string
  activity_week: string
  event_count: number
  posts_generated: number
  posts_copied: number
}

// ─── 1. Activation Rate ───────────────────────────────────────────────────────
/**
 * % of a signup cohort who generated ≥1 post within their first 7 days.
 *
 * Answers: "What % of this week's signups actually used the product?"
 */
export async function getActivationRate(cohortWeek: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from('cohort_users')
    .select('user_id, activated_at')
    .eq('cohort_week', cohortWeek)

  if (error || !data || data.length === 0) return null

  const activated = data.filter((u) => u.activated_at !== null).length
  return Math.round((activated / data.length) * 1000) / 10   // one decimal
}

// ─── 2. Monthly Churn ─────────────────────────────────────────────────────────
/**
 * % of users who were active last month but not this month.
 * Uses weekly_user_activity — a user is "active" in a month if they have ≥1 row.
 *
 * Answers: "How much are we leaking month over month?"
 *
 * @param month  - ISO date string for first day of the month to measure
 *                 e.g. '2026-03-01'
 */
export async function getMonthlyChurn(month: string): Promise<number | null> {
  const monthStart = new Date(month)
  const prevMonthStart = new Date(monthStart)
  prevMonthStart.setMonth(prevMonthStart.getMonth() - 1)

  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  // Users active last month
  const { data: lastMonth, error: e1 } = await supabaseAdmin
    .from('weekly_user_activity')
    .select('user_id')
    .gte('activity_week', fmt(prevMonthStart))
    .lt('activity_week', fmt(monthStart))

  if (e1 || !lastMonth) return null
  if (lastMonth.length === 0) return 0

  const lastMonthIds = new Set(lastMonth.map((r) => r.user_id))

  // Users active this month
  const nextMonthStart = new Date(monthStart)
  nextMonthStart.setMonth(nextMonthStart.getMonth() + 1)

  const { data: thisMonth, error: e2 } = await supabaseAdmin
    .from('weekly_user_activity')
    .select('user_id')
    .gte('activity_week', fmt(monthStart))
    .lt('activity_week', fmt(nextMonthStart))

  if (e2 || !thisMonth) return null

  const thisMonthIds = new Set(thisMonth.map((r) => r.user_id))

  // Churned = were active last month, not active this month
  let churned = 0
  for (const id of lastMonthIds) {
    if (!thisMonthIds.has(id)) churned++
  }

  return Math.round((churned / lastMonthIds.size) * 1000) / 10
}

// ─── 3. LTV (Lifetime Value) ──────────────────────────────────────────────────
/**
 * Average revenue per user for a cohort, projected over lifetime.
 * Currently uses a simple ARPU / estimated_churn_rate model from the
 * cohort_revenue view. Will improve as we accumulate real churn data.
 *
 * Answers: "How much is a user from cohort X actually worth?"
 */
export async function getLTV(cohortWeek: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from('cohort_revenue')
    .select('estimated_ltv')
    .eq('cohort_week', cohortWeek)
    .neq('plan', 'free')
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data.estimated_ltv
}

// ─── 4. Week-4 Retention ──────────────────────────────────────────────────────
/**
 * % of a cohort still active at exactly week 4 (weeks_since_signup = 4).
 * Week 4 is the canonical "did they stick?" checkpoint.
 *
 * Answers: "How many people are still around a month after signup?"
 */
export async function getW4Retention(cohortWeek: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from('cohort_retention_matrix')
    .select('retention_pct')
    .eq('cohort_week', cohortWeek)
    .eq('weeks_since_signup', 4)
    .maybeSingle()

  if (error || !data) return null
  return data.retention_pct
}

// ─── 5. Cohort Delta ──────────────────────────────────────────────────────────
/**
 * % change in a metric between two cohorts (positive = improvement).
 *
 * Answers: "Is our W4 retention getting better or worse over time?"
 *
 * @example
 *   const delta = await getCohortDelta('w4_retention', '2026-01-06', '2026-03-03')
 *   // Returns +12.5 meaning March cohort retained 12.5 percentage points more than January
 */
export async function getCohortDelta(
  metric: Exclude<MetricName, 'monthly_churn' | 'cohort_delta'>,
  cohortA: string,   // earlier cohort (baseline)
  cohortB: string,   // later cohort (comparison)
): Promise<number | null> {
  const fetch = metric === 'activation_rate' ? getActivationRate
    : metric === 'ltv'           ? getLTV
    : metric === 'w4_retention'  ? getW4Retention
    : null

  if (!fetch) return null

  const [a, b] = await Promise.all([fetch(cohortA), fetch(cohortB)])
  if (a === null || b === null) return null

  return Math.round((b - a) * 10) / 10   // one decimal, absolute delta
}

// ─── Bulk queries for dashboard ───────────────────────────────────────────────

/**
 * Fetch the full retention matrix for the dashboard heatmap.
 * Filters to the last N cohort weeks.
 */
export async function getRetentionMatrix(lastNWeeks = 16): Promise<RetentionMatrixRow[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - lastNWeeks * 7)

  const { data, error } = await supabaseAdmin
    .from('cohort_retention_matrix')
    .select('cohort_week, weeks_since_signup, cohort_size, retained_users, retention_pct')
    .gte('cohort_week', cutoff.toISOString().slice(0, 10))
    .order('cohort_week', { ascending: true })
    .order('weeks_since_signup', { ascending: true })

  if (error) {
    console.error(JSON.stringify({ event: 'metrics_error', fn: 'getRetentionMatrix', error: error.message }))
    return []
  }
  return (data ?? []) as RetentionMatrixRow[]
}

/**
 * Fetch cohort summary rows for the revenue/LTV table.
 */
export async function getCohortRevenueSummary(lastNWeeks = 16): Promise<CohortRow[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - lastNWeeks * 7)

  // Join cohort_users + cohort_retention_matrix (w4) + cohort_revenue
  const { data: cohorts, error: e1 } = await supabaseAdmin
    .from('cohort_users')
    .select('cohort_week, user_id, activated_at')
    .gte('cohort_week', cutoff.toISOString().slice(0, 10))

  const { data: w4, error: e2 } = await supabaseAdmin
    .from('cohort_retention_matrix')
    .select('cohort_week, cohort_size, retained_users, retention_pct')
    .eq('weeks_since_signup', 4)
    .gte('cohort_week', cutoff.toISOString().slice(0, 10))

  const { data: revenue, error: e3 } = await supabaseAdmin
    .from('cohort_revenue')
    .select('cohort_week, paid_users, mrr_contribution, arpu, estimated_ltv')
    .gte('cohort_week', cutoff.toISOString().slice(0, 10))

  if (e1 || e2 || e3) return []

  // Group cohorts by week
  const weekMap = new Map<string, CohortRow>()

  for (const u of cohorts ?? []) {
    const week = u.cohort_week as string
    if (!weekMap.has(week)) {
      weekMap.set(week, {
        cohort_week: week,
        cohort_size: 0,
        activated_users: 0,
        activation_rate_pct: 0,
        w4_retained: 0,
        w4_retention_pct: 0,
        paid_users: 0,
        mrr_contribution: 0,
        arpu: 0,
        estimated_ltv: 0,
      })
    }
    const row = weekMap.get(week)!
    row.cohort_size++
    if (u.activated_at) row.activated_users++
  }

  // Merge W4 data
  for (const w of w4 ?? []) {
    const row = weekMap.get(w.cohort_week as string)
    if (row) {
      row.w4_retained = w.retained_users
      row.w4_retention_pct = w.retention_pct
    }
  }

  // Merge revenue data
  for (const r of revenue ?? []) {
    const row = weekMap.get(r.cohort_week as string)
    if (row) {
      row.paid_users = r.paid_users ?? 0
      row.mrr_contribution = r.mrr_contribution ?? 0
      row.arpu = r.arpu ?? 0
      row.estimated_ltv = r.estimated_ltv ?? 0
    }
  }

  // Compute activation rates
  for (const row of weekMap.values()) {
    row.activation_rate_pct = row.cohort_size > 0
      ? Math.round((row.activated_users / row.cohort_size) * 1000) / 10
      : 0
  }

  return Array.from(weekMap.values()).sort(
    (a, b) => new Date(a.cohort_week).getTime() - new Date(b.cohort_week).getTime()
  )
}

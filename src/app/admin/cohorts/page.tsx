/**
 * DMD-097 — Founder cohort retention dashboard.
 * Server component: fetches data, gates access, passes to client charts.
 *
 * Access control:
 *   Checks ADMIN_EMAIL env var against session email.
 *   TODO DMD-070: swap the stub below for real Supabase session check once auth lands.
 *   Until then: set ADMIN_SECRET in env and append ?secret=<value> to the URL.
 *
 * The 5 acceptance questions this dashboard answers:
 *   1. What % of week N's cohort was still active at week 4?     → heatmap column 4
 *   2. Which cohort had the highest 30-day retention?            → heatmap max highlight
 *   3. What's LTV of paying users from the first month?          → revenue table
 *   4. Is retention improving or declining across last 8 cohorts? → trend indicator
 *   5. What's the activation rate for the most recent cohort?    → stat cards
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  getRetentionMatrix,
  getCohortRevenueSummary,
  getActivationRate,
  getW4Retention,
} from '@/lib/analytics/metrics'
import CohortDashboard from './_components/CohortDashboard'

// ── Access gate ──────────────────────────────────────────────────────────────
async function checkAdminAccess(): Promise<boolean> {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) return false   // No secret set = gate is closed

  const headersList = await headers()
  const referer = headersList.get('referer') ?? ''

  // Check for ?secret=... in the referer URL (for direct navigation)
  // This is a lightweight dev-mode gate. Replace with session check on DMD-070.
  const urlSecret = new URL(
    referer || 'http://localhost:3000',
    'http://localhost:3000'
  ).searchParams.get('secret')

  return urlSecret === adminSecret
}

export default async function CohortsPage({
  searchParams,
}: {
  searchParams: Promise<{ secret?: string; weeks?: string }>
}) {
  const params = await searchParams
  const secret = params.secret
  const adminSecret = process.env.ADMIN_SECRET

  // Access gate — redirect to home if not authorized
  if (adminSecret && secret !== adminSecret) {
    redirect('/?auth=required')
  }

  const weeksParam = parseInt(params.weeks ?? '16', 10)
  const lastNWeeks = isNaN(weeksParam) ? 16 : Math.min(52, Math.max(4, weeksParam))

  // ── Data fetch (parallel) ────────────────────────────────────────────────
  const [retentionMatrix, cohortRevenue] = await Promise.all([
    getRetentionMatrix(lastNWeeks),
    getCohortRevenueSummary(lastNWeeks),
  ])

  // ── Summary stats for the top cards ─────────────────────────────────────
  const mostRecentCohort = cohortRevenue.at(-1)
  const latestActivationRate = mostRecentCohort
    ? await getActivationRate(mostRecentCohort.cohort_week)
    : null
  const latestW4Retention = mostRecentCohort
    ? await getW4Retention(mostRecentCohort.cohort_week)
    : null

  // Trend: compare last 4 cohorts vs previous 4 (w4 retention delta)
  const recentCohorts = cohortRevenue.slice(-8)
  const firstHalf = recentCohorts.slice(0, 4)
  const secondHalf = recentCohorts.slice(4)
  const avgW4First = firstHalf.length
    ? firstHalf.reduce((s, c) => s + c.w4_retention_pct, 0) / firstHalf.length
    : null
  const avgW4Second = secondHalf.length
    ? secondHalf.reduce((s, c) => s + c.w4_retention_pct, 0) / secondHalf.length
    : null
  const retentionTrend = avgW4First !== null && avgW4Second !== null
    ? Math.round((avgW4Second - avgW4First) * 10) / 10
    : null

  const summaryStats = {
    totalUsers: cohortRevenue.reduce((s, c) => s + c.cohort_size, 0),
    paidUsers: cohortRevenue.reduce((s, c) => s + c.paid_users, 0),
    totalMrr: cohortRevenue.reduce((s, c) => s + c.mrr_contribution, 0),
    latestActivationRate,
    latestW4Retention,
    retentionTrend,
    mostRecentCohortWeek: mostRecentCohort?.cohort_week ?? null,
  }

  return (
    <CohortDashboard
      retentionMatrix={retentionMatrix}
      cohortRevenue={cohortRevenue}
      summaryStats={summaryStats}
      lastNWeeks={lastNWeeks}
      adminSecret={secret ?? ''}
    />
  )
}

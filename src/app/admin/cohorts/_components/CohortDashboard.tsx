'use client'
/**
 * DMD-097 — Cohort retention dashboard (client component).
 * Receives pre-fetched data from the server page component.
 *
 * Requires Recharts: npm install recharts
 * (Add to package.json if not already present)
 *
 * Sections:
 *   1. Stat cards (5 key metrics summary)
 *   2. Retention heatmap (16-week grid)
 *   3. Cohort comparison curves (Recharts LineChart)
 *   4. Revenue + LTV table per cohort
 */

import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { RetentionMatrixRow, CohortRow } from '@/lib/analytics/metrics'

interface SummaryStats {
  totalUsers: number
  paidUsers: number
  totalMrr: number
  latestActivationRate: number | null
  latestW4Retention: number | null
  retentionTrend: number | null
  mostRecentCohortWeek: string | null
}

interface Props {
  retentionMatrix: RetentionMatrixRow[]
  cohortRevenue: CohortRow[]
  summaryStats: SummaryStats
  lastNWeeks: number
  adminSecret: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtWeek(isoDate: string): string {
  const d = new Date(isoDate)
  return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`
}

function fmtCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function retentionColor(pct: number | null): string {
  if (pct === null) return 'rgba(26,58,110,0.3)'
  if (pct >= 60) return 'rgba(124, 58, 237, 0.85)'
  if (pct >= 40) return 'rgba(124, 58, 237, 0.55)'
  if (pct >= 20) return 'rgba(124, 58, 237, 0.30)'
  if (pct >= 5)  return 'rgba(124, 58, 237, 0.15)'
  return 'rgba(26,58,110,0.2)'
}

// ─── Retention Heatmap ────────────────────────────────────────────────────────

function RetentionHeatmap({ matrix }: { matrix: RetentionMatrixRow[] }) {
  const [tooltip, setTooltip] = useState<{ week: string; weekN: number; pct: number } | null>(null)

  // Build cohort weeks list and max columns
  const cohortWeeks = [...new Set(matrix.map((r) => r.cohort_week))].sort()
  const maxWeeks = Math.min(16, Math.max(...matrix.map((r) => r.weeks_since_signup), 0) + 1)

  // Lookup map: cohortWeek → weeks_since_signup → retention_pct
  const lookup = new Map<string, Map<number, RetentionMatrixRow>>()
  for (const row of matrix) {
    if (!lookup.has(row.cohort_week)) lookup.set(row.cohort_week, new Map())
    lookup.get(row.cohort_week)!.set(row.weeks_since_signup, row)
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 font-semibold whitespace-nowrap" style={{ color: '#5a7dc4', minWidth: '80px' }}>
                Cohort
              </th>
              <th className="text-center py-2 px-1" style={{ color: '#5a7dc4', minWidth: '32px' }}>
                Size
              </th>
              {Array.from({ length: maxWeeks }, (_, i) => (
                <th key={i} className="text-center py-2 px-0.5 font-semibold" style={{ color: '#5a7dc4', minWidth: '36px' }}>
                  W{i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohortWeeks.map((week) => {
              const weekData = lookup.get(week)
              const cohortSize = weekData?.get(0)?.cohort_size ?? 0
              return (
                <tr key={week}>
                  <td className="py-1 pr-4 font-medium whitespace-nowrap" style={{ color: '#94afee' }}>
                    {fmtWeek(week)}
                  </td>
                  <td className="text-center py-1 px-1" style={{ color: '#5a7dc4' }}>
                    {cohortSize}
                  </td>
                  {Array.from({ length: maxWeeks }, (_, weekN) => {
                    const row = weekData?.get(weekN)
                    const pct = row?.retention_pct ?? null
                    return (
                      <td
                        key={weekN}
                        className="py-1 px-0.5 text-center rounded cursor-default relative"
                        style={{
                          backgroundColor: retentionColor(pct),
                          color: pct !== null && pct >= 30 ? '#e0e9ff' : '#5a7dc4',
                        }}
                        onMouseEnter={() => pct !== null && setTooltip({ week, weekN, pct })}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {pct !== null ? `${pct}%` : '—'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-4 text-xs" style={{ color: '#5a7dc4' }}>
        <span>Retention:</span>
        {[
          { label: '≥60%', color: 'rgba(124,58,237,0.85)' },
          { label: '40–59%', color: 'rgba(124,58,237,0.55)' },
          { label: '20–39%', color: 'rgba(124,58,237,0.30)' },
          { label: '5–19%', color: 'rgba(124,58,237,0.15)' },
          { label: '<5%', color: 'rgba(26,58,110,0.2)' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="mt-2 text-xs px-3 py-1.5 rounded-lg inline-block"
          style={{ backgroundColor: 'rgba(124,58,237,0.2)', color: '#b8a4ff' }}
        >
          Cohort {fmtWeek(tooltip.week)} · Week {tooltip.weekN} · {tooltip.pct}% retained
        </div>
      )}
    </div>
  )
}

// ─── Cohort Curves (Line Chart) ───────────────────────────────────────────────

const LINE_COLORS = [
  '#7c3aed', '#06b6d4', '#f59e0b', '#10b981',
  '#ef4444', '#8b5cf6', '#0ea5e9', '#84cc16',
]

function CohortCurves({ matrix }: { matrix: RetentionMatrixRow[] }) {
  const cohortWeeks = [...new Set(matrix.map((r) => r.cohort_week))].sort().slice(-8)

  // Build chart data: x = weeks_since_signup, one key per cohort
  const maxWeek = Math.max(...matrix.map((r) => r.weeks_since_signup), 0)
  const chartData = Array.from({ length: Math.min(maxWeek + 1, 13) }, (_, i) => {
    const point: Record<string, number | string> = { week: `W${i}` }
    for (const cohortWeek of cohortWeeks) {
      const row = matrix.find(
        (r) => r.cohort_week === cohortWeek && r.weeks_since_signup === i
      )
      if (row) point[fmtWeek(cohortWeek)] = row.retention_pct
    }
    return point
  })

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,58,110,0.4)" />
        <XAxis dataKey="week" tick={{ fill: '#5a7dc4', fontSize: 11 }} />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: '#5a7dc4', fontSize: 11 }}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#0c1c3d',
            border: '1px solid rgba(124,58,237,0.4)',
            borderRadius: '8px',
            color: '#e0e9ff',
          }}
          formatter={(value) => [`${value}%`, '']}
        />
        <Legend
          wrapperStyle={{ color: '#94afee', fontSize: '11px' }}
        />
        {cohortWeeks.map((week, i) => (
          <Line
            key={week}
            type="monotone"
            dataKey={fmtWeek(week)}
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Revenue Table ────────────────────────────────────────────────────────────

function RevenueTable({ cohorts }: { cohorts: CohortRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(26,58,110,0.6)' }}>
            {['Cohort', 'Size', 'Activated', 'Act. Rate', 'W4 Ret.', 'Paid', 'MRR', 'ARPU', 'Est. LTV'].map((h) => (
              <th key={h} className="text-left pb-3 pr-4 font-semibold" style={{ color: '#5a7dc4' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...cohorts].reverse().map((c) => (
            <tr
              key={c.cohort_week}
              className="transition-colors"
              style={{ borderBottom: '1px solid rgba(26,58,110,0.3)' }}
            >
              <td className="py-3 pr-4 font-medium whitespace-nowrap" style={{ color: '#e0e9ff' }}>
                {fmtWeek(c.cohort_week)}
              </td>
              <td className="py-3 pr-4" style={{ color: '#94afee' }}>{c.cohort_size}</td>
              <td className="py-3 pr-4" style={{ color: '#94afee' }}>{c.activated_users}</td>
              <td className="py-3 pr-4">
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: c.activation_rate_pct >= 50 ? 'rgba(124,58,237,0.2)' : 'rgba(26,58,110,0.4)',
                    color: c.activation_rate_pct >= 50 ? '#b8a4ff' : '#5a7dc4',
                  }}
                >
                  {c.activation_rate_pct}%
                </span>
              </td>
              <td className="py-3 pr-4">
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: c.w4_retention_pct >= 30 ? 'rgba(6,182,212,0.15)' : 'rgba(26,58,110,0.4)',
                    color: c.w4_retention_pct >= 30 ? '#22d3ee' : '#5a7dc4',
                  }}
                >
                  {c.w4_retention_pct > 0 ? `${c.w4_retention_pct}%` : '—'}
                </span>
              </td>
              <td className="py-3 pr-4" style={{ color: '#94afee' }}>{c.paid_users}</td>
              <td className="py-3 pr-4" style={{ color: '#94afee' }}>
                {c.mrr_contribution > 0 ? fmtCurrency(c.mrr_contribution) : '—'}
              </td>
              <td className="py-3 pr-4" style={{ color: '#94afee' }}>
                {c.arpu > 0 ? fmtCurrency(c.arpu) : '—'}
              </td>
              <td className="py-3 pr-4 font-semibold" style={{ color: c.estimated_ltv > 0 ? '#b8a4ff' : '#5a7dc4' }}>
                {c.estimated_ltv > 0 ? fmtCurrency(c.estimated_ltv) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, positive,
}: {
  label: string
  value: string
  sub?: string
  positive?: boolean | null
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#5a7dc4' }}>{label}</p>
      <p className="text-3xl font-extrabold" style={{ color: '#e0e9ff' }}>{value}</p>
      {sub && (
        <p
          className="text-xs mt-1 font-medium"
          style={{ color: positive === true ? '#4ade80' : positive === false ? '#f87171' : '#5a7dc4' }}
        >
          {sub}
        </p>
      )}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function CohortDashboard({
  retentionMatrix,
  cohortRevenue,
  summaryStats,
  lastNWeeks,
  adminSecret,
}: Props) {
  const empty = cohortRevenue.length === 0 && retentionMatrix.length === 0

  const trendLabel = summaryStats.retentionTrend !== null
    ? `${summaryStats.retentionTrend > 0 ? '+' : ''}${summaryStats.retentionTrend}pp vs prev 4 cohorts`
    : 'Not enough data yet'

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#070e21' }}>
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold" style={{ color: '#e0e9ff' }}>
              Cohort Retention
            </h1>
            <p className="mt-1 text-sm" style={{ color: '#5a7dc4' }}>
              Last {lastNWeeks} weeks · refreshed nightly at 2am UTC
            </p>
          </div>
          <div className="flex gap-3">
            {[8, 16, 26].map((w) => (
              <a
                key={w}
                href={`/admin/cohorts?secret=${adminSecret}&weeks=${w}`}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={lastNWeeks === w
                  ? { backgroundColor: 'rgba(124,58,237,0.3)', color: '#b8a4ff' }
                  : { color: '#5a7dc4' }
                }
              >
                {w}w
              </a>
            ))}
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard
            label="Total users"
            value={summaryStats.totalUsers.toLocaleString()}
          />
          <StatCard
            label="Paying users"
            value={summaryStats.paidUsers.toLocaleString()}
            sub={summaryStats.totalUsers > 0
              ? `${Math.round(summaryStats.paidUsers / summaryStats.totalUsers * 100)}% conversion`
              : undefined
            }
          />
          <StatCard
            label="MRR"
            value={fmtCurrency(summaryStats.totalMrr)}
          />
          <StatCard
            label="Latest activation"
            value={summaryStats.latestActivationRate !== null
              ? `${summaryStats.latestActivationRate}%`
              : '—'
            }
            sub={summaryStats.mostRecentCohortWeek
              ? `Cohort ${fmtWeek(summaryStats.mostRecentCohortWeek)}`
              : undefined
            }
          />
          <StatCard
            label="W4 retention trend"
            value={summaryStats.retentionTrend !== null
              ? `${summaryStats.retentionTrend > 0 ? '+' : ''}${summaryStats.retentionTrend}pp`
              : '—'
            }
            sub={trendLabel}
            positive={summaryStats.retentionTrend !== null
              ? summaryStats.retentionTrend >= 0
              : null
            }
          />
        </div>

        {empty ? (
          /* Empty state */
          <div
            className="rounded-2xl p-16 text-center"
            style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}
          >
            <p className="text-2xl mb-3" >📊</p>
            <h3 className="text-lg font-bold mb-2" style={{ color: '#e0e9ff' }}>No cohort data yet</h3>
            <p className="text-sm max-w-md mx-auto" style={{ color: '#5a7dc4' }}>
              Data will appear here once users sign up and events start flowing into the
              analytics_events table. Run the migrations, then wait for the nightly cron
              to refresh the materialized views.
            </p>
            <div
              className="mt-6 text-xs font-mono p-3 rounded-xl inline-block text-left"
              style={{ backgroundColor: 'rgba(7,14,33,0.8)', color: '#9775fa' }}
            >
              -- Check event count:<br />
              SELECT COUNT(*) FROM analytics_events;<br />
              -- Manual refresh:<br />
              SELECT refresh_analytics_views();
            </div>
          </div>
        ) : (
          <>
            {/* Heatmap */}
            <div
              className="rounded-2xl p-6 mb-6"
              style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}
            >
              <h2 className="font-bold mb-1" style={{ color: '#e0e9ff' }}>Retention Heatmap</h2>
              <p className="text-xs mb-5" style={{ color: '#5a7dc4' }}>
                Each cell = % of cohort still active at week N. W0 = signup week (always ~100%).
              </p>
              <RetentionHeatmap matrix={retentionMatrix} />
            </div>

            {/* Curves */}
            <div
              className="rounded-2xl p-6 mb-6"
              style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}
            >
              <h2 className="font-bold mb-1" style={{ color: '#e0e9ff' }}>Cohort Curves</h2>
              <p className="text-xs mb-5" style={{ color: '#5a7dc4' }}>
                Last 8 cohorts. Upward drift over time = retention is improving.
              </p>
              <CohortCurves matrix={retentionMatrix} />
            </div>

            {/* Revenue table */}
            <div
              className="rounded-2xl p-6"
              style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}
            >
              <h2 className="font-bold mb-1" style={{ color: '#e0e9ff' }}>Revenue & LTV by Cohort</h2>
              <p className="text-xs mb-5" style={{ color: '#5a7dc4' }}>
                Est. LTV uses ARPU / 5% churn until real churn data is available (6+ months).
              </p>
              <RevenueTable cohorts={cohortRevenue} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * DMD-097 — Vercel Cron: nightly materialized view refresh.
 * Schedule: 0 2 * * * (2am UTC) — configured in vercel.json.
 *
 * Security: validates Authorization header against CRON_SECRET.
 * Vercel automatically sends Authorization: Bearer <CRON_SECRET> on cron calls
 * when CRON_SECRET is set in the project environment variables.
 *
 * Manual trigger:
 *   curl -X GET https://your-domain.com/api/cron/refresh-views \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * Monitoring:
 *   - Logs structured JSON on success and failure
 *   - On Vercel, cron logs appear in the Functions tab of your deployment
 *   - Wire CRON_FAILURE_WEBHOOK to a Slack/Discord webhook for alerting
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 300   // 5-minute cap — refresh should take <30s at launch scale

export async function GET(req: Request) {
  const start = Date.now()

  // ── Auth check ──────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn(JSON.stringify({
      event: 'cron_unauthorized',
      path: '/api/cron/refresh-views',
      timestamp: new Date().toISOString(),
    }))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Supabase guard ───────────────────────────────────────────────────────
  const isConfigured =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'your_supabase_url' &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY !== 'your_service_role_key'

  if (!isConfigured) {
    console.log(JSON.stringify({
      event: 'cron_skipped',
      reason: 'Supabase not configured',
      timestamp: new Date().toISOString(),
    }))
    return NextResponse.json({ skipped: true, reason: 'Supabase not configured' })
  }

  // ── Refresh all 4 views via stored function ──────────────────────────────
  try {
    const { error } = await supabaseAdmin.rpc('refresh_analytics_views')

    const elapsed = Date.now() - start

    if (error) {
      console.error(JSON.stringify({
        event: 'cron_refresh_error',
        error: error.message,
        elapsed_ms: elapsed,
        timestamp: new Date().toISOString(),
      }))

      // Alert webhook (optional — set CRON_FAILURE_WEBHOOK in env)
      const webhook = process.env.CRON_FAILURE_WEBHOOK
      if (webhook) {
        fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `⚠️ Drafture: analytics view refresh failed\n\`${error.message}\``,
          }),
        }).catch(() => {})
      }

      return NextResponse.json(
        { ok: false, error: error.message, elapsed_ms: elapsed },
        { status: 500 }
      )
    }

    console.log(JSON.stringify({
      event: 'cron_refresh_complete',
      views_refreshed: 4,
      elapsed_ms: elapsed,
      timestamp: new Date().toISOString(),
    }))

    return NextResponse.json({
      ok: true,
      views_refreshed: ['cohort_users', 'weekly_user_activity', 'cohort_retention_matrix', 'cohort_revenue'],
      elapsed_ms: elapsed,
    })

  } catch (err) {
    const elapsed = Date.now() - start
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error(JSON.stringify({
      event: 'cron_refresh_exception',
      error: message,
      elapsed_ms: elapsed,
      timestamp: new Date().toISOString(),
    }))
    return NextResponse.json({ ok: false, error: message, elapsed_ms: elapsed }, { status: 500 })
  }
}

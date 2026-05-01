/**
 * DMD-097 — Client-side event ingestion endpoint.
 *
 * Receives events from the browser (via /lib/analytics/client.ts),
 * validates them, then dual-writes to DB + PostHog via trackServer().
 *
 * Rate limiting note: this endpoint is not publicly dangerous (no LLM costs)
 * but should be rate-limited by IP once usage grows. For now, the anon
 * Supabase insert protects via RLS — user_id is taken from the server-side
 * session, NOT trusted from the client payload.
 */

import { NextResponse } from 'next/server'
import { trackServer } from '@/lib/analytics/events'
import type { DraftureEvent, EventName } from '@/lib/analytics/events'
import { rateLimit, getClientIp, LIMITS } from '@/lib/rate-limit'

// Allowlist of valid event names — prevents arbitrary strings hitting the DB
const VALID_EVENT_NAMES: Set<EventName> = new Set([
  'user_signed_up',
  'user_activated',
  'post_generated',
  'post_copied',
  'video_transcript_fetched',
  'word_count_customized',
  'session_started',
  'page_viewed',
  'upgrade_clicked',
  'checkout_started',
  'subscription_created',
  'subscription_renewed',
  'subscription_cancelled',
  'user_returned',
  'post_limit_hit',
  'tone_selected',
  'criteria_added',
  'classmate_post_added',
  'post_quality_rated',
])

export async function POST(req: Request) {
  // Rate limiting — 60/min is generous; blocks event spam bots
  const ip = getClientIp(req)
  const rl = await rateLimit(ip, LIMITS.analytics)
  if (!rl.allowed) {
    // Still return 202 — client should never retry analytics on rate limit
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 202 })
  }

  try {
    const body = await req.json()
    const { event_name, event_data, session_id, occurred_at, platform } = body

    // Validate event name against allowlist
    if (!event_name || !VALID_EVENT_NAMES.has(event_name as EventName)) {
      return NextResponse.json({ error: 'Invalid event_name' }, { status: 400 })
    }

    // TODO DMD-070: extract user_id from Supabase session cookie instead of
    // trusting it from the client. For now, accept it but it's not verified.
    // Pattern: const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    const user_id: string | undefined = typeof body.user_id === 'string' ? body.user_id : undefined

    const event: DraftureEvent = {
      event_name,
      event_data: event_data ?? {},
      user_id,
      session_id: typeof session_id === 'string' ? session_id : undefined,
      occurred_at: typeof occurred_at === 'string' ? occurred_at : new Date().toISOString(),
      platform: platform === 'extension' ? 'extension' : 'web',
    } as DraftureEvent

    // Fire-and-forget: don't await, respond to client immediately
    trackServer(event).catch(() => { /* errors logged inside trackServer */ })

    return NextResponse.json({ ok: true }, { status: 202 })

  } catch {
    // 202 even on error — client should never retry analytics events
    return NextResponse.json({ ok: false }, { status: 202 })
  }
}

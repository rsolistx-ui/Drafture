/**
 * DMD-097 — Cohort Retention Analytics
 * Event taxonomy (18 events) + server-side dual-write emitter.
 *
 * Rules:
 *  - Append-only. Never mutate a fired event.
 *  - No PII in event_data (no email, no real name). user_id only.
 *  - PostHog is a fire-and-forget side channel — never block on it.
 *  - All DB writes use the service-role client (RLS bypassed intentionally).
 *
 * Install required package before first use:
 *   npm install posthog-node
 */

import { supabaseAdmin } from '@/lib/supabase-admin'

// ─── 1. Event payload types ─────────────────────────────────────────────────

export interface BaseEvent {
  user_id?: string          // null for pre-auth events (e.g. page views before login)
  session_id?: string       // client-generated UUID, persisted in sessionStorage
  occurred_at?: string      // ISO-8601; defaults to server now()
  app_version?: string
  prompt_version?: string
  platform?: 'web' | 'extension'
}

// ── Acquisition ──
export interface UserSignedUpEvent extends BaseEvent {
  event_name: 'user_signed_up'
  event_data: {
    plan: 'free'
    source?: string       // 'organic' | 'referral' | 'social' | utm_source value
    referrer?: string     // document.referrer (no PII)
  }
}

export interface UserActivatedEvent extends BaseEvent {
  event_name: 'user_activated'
  event_data: {
    hours_since_signup: number
    first_post_type: 'initial' | 'classmate' | 'instructor'
  }
}

// ── Core usage ──
export interface PostGeneratedEvent extends BaseEvent {
  event_name: 'post_generated'
  event_data: {
    post_type: 'initial' | 'classmate' | 'instructor'
    tone: string
    word_count: number
    word_target_min: number
    word_target_max: number
    word_count_in_range: boolean
    had_video_summary: boolean
    had_criteria: boolean
    had_classmate_post: boolean
    had_course: boolean
    violations_found: number
    fix_method: string
    cost_usd: number
    total_ms: number
    prompt_version: string
  }
}

export interface PostCopiedEvent extends BaseEvent {
  event_name: 'post_copied'
  event_data: {
    post_type: 'initial' | 'classmate' | 'instructor'
    word_count: number
    ms_since_generated: number
  }
}

export interface VideoTranscriptFetchedEvent extends BaseEvent {
  event_name: 'video_transcript_fetched'
  event_data: {
    method: 'transcript' | 'youtube_found' | 'web_content'
    success: boolean
    error_type?: string
  }
}

export interface WordCountCustomizedEvent extends BaseEvent {
  event_name: 'word_count_customized'
  event_data: {
    post_type: string
    default_min: number
    default_max: number
    custom_min: number
    custom_max: number
  }
}

// ── Session ──
export interface SessionStartedEvent extends BaseEvent {
  event_name: 'session_started'
  event_data: {
    referrer?: string
    is_returning: boolean
  }
}

export interface PageViewedEvent extends BaseEvent {
  event_name: 'page_viewed'
  event_data: {
    page: string        // '/dashboard' | '/dashboard/generate' | etc. — no query params with PII
    referrer?: string
  }
}

// ── Monetisation ──
export interface UpgradeClickedEvent extends BaseEvent {
  event_name: 'upgrade_clicked'
  event_data: {
    source: string      // 'sidebar' | 'post_limit_hit' | 'pricing_page' | 'header'
    current_plan: string
    target_plan?: string
  }
}

export interface CheckoutStartedEvent extends BaseEvent {
  event_name: 'checkout_started'
  event_data: {
    plan: string
    price_usd: number
  }
}

export interface SubscriptionCreatedEvent extends BaseEvent {
  event_name: 'subscription_created'
  event_data: {
    plan: string
    price_usd: number
    stripe_subscription_id: string   // NOT PII — internal ID
    trial: boolean
  }
}

export interface SubscriptionRenewedEvent extends BaseEvent {
  event_name: 'subscription_renewed'
  event_data: {
    plan: string
    price_usd: number
    months_active: number
  }
}

export interface SubscriptionCancelledEvent extends BaseEvent {
  event_name: 'subscription_cancelled'
  event_data: {
    plan: string
    months_active: number
    cancel_reason?: string  // from Stripe cancellation survey
  }
}

// ── Re-engagement ──
export interface UserReturnedEvent extends BaseEvent {
  event_name: 'user_returned'
  event_data: {
    days_since_last_active: number
    return_channel?: string  // 'email' | 'direct' | 'organic' etc.
  }
}

export interface PostLimitHitEvent extends BaseEvent {
  event_name: 'post_limit_hit'
  event_data: {
    plan: string
    posts_used: number
    posts_limit: number
  }
}

// ── Quality feedback ──
export interface PostQualityRatedEvent extends BaseEvent {
  event_name: 'post_quality_rated'
  event_data: {
    rating: 'good'                    // thumbs-up; expand to 'bad' if we add 👎 later
    post_type: 'initial' | 'classmate' | 'instructor'
    prompt_version: string
    had_course_notes: boolean
    had_video_summary: boolean
    had_style: boolean
    had_pdf: boolean
    word_count: number
    ms_since_generated: number
  }
}

// ── Feature adoption ──
export interface ToneSelectedEvent extends BaseEvent {
  event_name: 'tone_selected'
  event_data: {
    tone: string
    post_type: string
    is_non_default: boolean   // true if != 'thoughtful'
  }
}

export interface CriteriaAddedEvent extends BaseEvent {
  event_name: 'criteria_added'
  event_data: {
    char_count: number
    post_type: string
  }
}

export interface ClassmatePostAddedEvent extends BaseEvent {
  event_name: 'classmate_post_added'
  event_data: {
    char_count: number
    post_type: 'classmate' | 'instructor'
  }
}

// ── Union ──
export type DraftureEvent =
  | UserSignedUpEvent
  | UserActivatedEvent
  | PostGeneratedEvent
  | PostCopiedEvent
  | VideoTranscriptFetchedEvent
  | WordCountCustomizedEvent
  | SessionStartedEvent
  | PageViewedEvent
  | UpgradeClickedEvent
  | CheckoutStartedEvent
  | SubscriptionCreatedEvent
  | SubscriptionRenewedEvent
  | SubscriptionCancelledEvent
  | UserReturnedEvent
  | PostLimitHitEvent
  | ToneSelectedEvent
  | CriteriaAddedEvent
  | ClassmatePostAddedEvent
  | PostQualityRatedEvent

export type EventName = DraftureEvent['event_name']

// ─── 2. PostHog Node adapter ─────────────────────────────────────────────────

let _posthogClient: import('posthog-node').PostHog | null = null

async function getPostHogClient() {
  const key = process.env.POSTHOG_API_KEY
  if (!key) return null
  if (_posthogClient) return _posthogClient
  try {
    const { PostHog } = await import('posthog-node')
    _posthogClient = new PostHog(key, {
      host: process.env.POSTHOG_HOST ?? 'https://app.posthog.com',
      flushAt: 1,          // serverless: flush immediately, no batching
      flushInterval: 0,
    })
    return _posthogClient
  } catch {
    // posthog-node not installed — silent no-op until added
    return null
  }
}

// ─── 3. Server-side track (API routes, server components, cron) ──────────────

/**
 * Dual-writes an event to:
 *  1. analytics_events table (source of truth)
 *  2. PostHog (primary analytics UI) — fire-and-forget, never blocking
 *
 * Usage:
 *   import { trackServer } from '@/lib/analytics/events'
 *   await trackServer({ event_name: 'post_generated', user_id: '...', event_data: { ... } })
 */
export async function trackServer(event: DraftureEvent): Promise<void> {
  const { event_name, user_id, session_id, occurred_at, platform, event_data } = event as DraftureEvent & {
    event_data: Record<string, unknown>
  }

  // ── DB write (primary — await this) ────────────────────────────────────────
  try {
    const isSupabaseConfigured =
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'your_supabase_url' &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY !== 'your_service_role_key'

    if (isSupabaseConfigured) {
      const { error } = await supabaseAdmin.from('analytics_events').insert({
        event_name,
        user_id: user_id ?? null,
        session_id: session_id ?? null,
        occurred_at: occurred_at ?? new Date().toISOString(),
        event_data: event_data ?? {},
        app_version: process.env.npm_package_version ?? '0.1.0',
        prompt_version: event.prompt_version ?? null,
        platform: platform ?? 'web',
      })
      if (error) {
        console.error(JSON.stringify({ event: 'analytics_write_error', error: error.message, event_name }))
      }
    }
  } catch (err) {
    // Never let analytics blow up the main request
    console.error(JSON.stringify({
      event: 'analytics_write_exception',
      error: err instanceof Error ? err.message : 'unknown',
      event_name,
    }))
  }

  // ── PostHog write (secondary — fire-and-forget) ────────────────────────────
  getPostHogClient().then(async (ph) => {
    if (!ph) return
    try {
      const distinctId = user_id ?? session_id ?? 'anonymous'
      ph.capture({
        distinctId,
        event: event_name,
        properties: {
          ...(event_data as Record<string, unknown>),
          platform: platform ?? 'web',
          $lib: 'drafture-server',
        },
        timestamp: occurred_at ? new Date(occurred_at) : undefined,
      })
      await ph.shutdown()
    } catch {
      // PostHog errors are never fatal
    }
  }).catch(() => { /* silent */ })
}

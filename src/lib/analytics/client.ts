'use client'
/**
 * DMD-097 — Client-side analytics track function.
 *
 * POST events to /api/analytics/event, which dual-writes to DB + PostHog.
 * Fire-and-forget — never awaited in UI code.
 *
 * Usage (in any 'use client' component):
 *   import { track } from '@/lib/analytics/client'
 *   track({ event_name: 'post_copied', event_data: { ... } })
 */

import type { DraftureEvent } from './events'

// Session ID: generated once per browser session, stored in sessionStorage
function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  const key = 'drafture_session_id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

/**
 * Client-side event track.
 * Always fire-and-forget — safe to call without await in event handlers.
 */
export function track(event: DraftureEvent): void {
  const payload = {
    ...event,
    session_id: event.session_id ?? getSessionId(),
    occurred_at: event.occurred_at ?? new Date().toISOString(),
    platform: event.platform ?? 'web',
  }

  fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    // keepalive ensures the request completes even if the page is unloaded
    keepalive: true,
  }).catch(() => {
    // Silent failure — analytics must never break the UI
  })
}

/**
 * Supabase service-role client — server-side only.
 * Never import this in client components or expose to the browser.
 *
 * Used for:
 *   - analytics_events writes (bypasses RLS — we own the table)
 *   - Materialized view refreshes from cron
 *   - Admin queries
 *
 * Lazy singleton: client is created on first use, not at module load time.
 * This prevents build-time failures when env vars are placeholders.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient | null {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (
    !url || !key ||
    url === 'your_supabase_url' ||
    key === 'your_service_role_key'
  ) {
    // Not configured — callers should handle null and no-op gracefully
    return null
  }

  try {
    _client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    return _client
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: 'supabase_admin_init_error',
        error: err instanceof Error ? err.message : 'unknown',
      })
    )
    return null
  }
}

/**
 * @deprecated Use getSupabaseAdmin() for lazy initialization.
 * Kept for backward compatibility — returns null if not configured.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin()
    if (!client) {
      // Return a no-op function for any method call when not configured
      return () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
    }
    const value = (client as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})

/**
 * Supabase server-side client with cookie-based session.
 *
 * Use in:
 *  - server components (read user)
 *  - route handlers (read or mutate user state)
 *  - middleware (refresh session, redirect unauthenticated users)
 *
 * Never import this in a client component.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function getSupabaseServer() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component. Safe to ignore. Middleware refreshes the session.
          }
        },
      },
    }
  )
}

/**
 * Returns the authenticated user, or null. Used by route handlers and pages.
 */
export async function getCurrentUser() {
  const supabase = await getSupabaseServer()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return null
  return data.user
}

/**
 * Returns the user's profile row joined with auth user. null if not authenticated.
 */
export async function getCurrentProfile() {
  const supabase = await getSupabaseServer()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .single()

  return profile ? { user: userData.user, profile } : null
}


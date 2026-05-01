import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit, getClientIp, LIMITS } from '@/lib/rate-limit'
import { trackServer } from '@/lib/analytics/events'

const VALID_PLANS = new Set(['starter', 'unlimited'])

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = await rateLimit(`signup:${ip}`, LIMITS.style ?? { requests: 5, window: '10 m' })
  if (!rl.allowed) return NextResponse.json({ error: rl.message }, { status: 429 })

  let body: { name?: string; email?: string; password?: string; plan?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }) }

  const name     = (body.name ?? '').toString().trim().slice(0, 120)
  const email    = (body.email ?? '').toString().trim().toLowerCase()
  const password = (body.password ?? '').toString()
  const plan     = body.plan && VALID_PLANS.has(body.plan) ? body.plan : null

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email.' }, { status: 400 })
  }

  const supabase = await getSupabaseServer()
  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/api/auth/callback`,
      data: { full_name: name },
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Mark honor code accepted via service role (the trigger created the profile row).
  const admin = getSupabaseAdmin()
  if (admin && data.user?.id) {
    await admin
      .from('profiles')
      .update({ honor_code_accepted_at: new Date().toISOString() })
      .eq('id', data.user.id)
  }

  // Fire signup event.
  if (data.user?.id) {
    trackServer({
      event_name: 'user_signed_up',
      user_id: data.user.id,
      event_data: { plan: 'free' },
    }).catch(() => {})
  }

  // If they wanted a paid plan, mint a checkout link they can be redirected to.
  let checkoutUrl: string | null = null
  if (plan && data.session) {
    try {
      const checkoutRes = await fetch(`${origin}/api/stripe/checkout`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Forward the just-set cookies so the checkout route sees the session.
          cookie: req.headers.get('cookie') ?? '',
        },
        body: JSON.stringify({ plan }),
      })
      const checkoutData = await checkoutRes.json().catch(() => ({}))
      if (checkoutRes.ok && checkoutData.url) checkoutUrl = checkoutData.url
    } catch {
      /* fall through. user lands on dashboard. */
    }
  }

  return NextResponse.json({
    ok: true,
    needsEmailConfirmation: !data.session,
    checkoutUrl,
  })
}

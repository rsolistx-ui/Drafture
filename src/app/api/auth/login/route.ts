import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { rateLimit, getClientIp, LIMITS } from '@/lib/rate-limit'

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = await rateLimit(`login:${ip}`, LIMITS.style ?? { requests: 10, window: '10 m' })
  if (!rl.allowed) return NextResponse.json({ error: rl.message }, { status: 429 })

  let body: { email?: string; password?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }) }

  const email    = (body.email ?? '').toString().trim().toLowerCase()
  const password = (body.password ?? '').toString()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  const supabase = await getSupabaseServer()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Generic error to avoid account enumeration.
    return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}

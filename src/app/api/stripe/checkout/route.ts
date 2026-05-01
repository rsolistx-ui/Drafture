import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { getStripe, PLANS, type PlanId } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { trackServer } from '@/lib/analytics/events'

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 })
  }

  let body: { plan?: string }
  try { body = await req.json() } catch { body = {} }

  const planId = body.plan as PlanId | undefined
  if (!planId || planId === 'free' || !PLANS[planId]) {
    return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 })
  }

  const plan = PLANS[planId]
  if (!plan.stripePriceId) {
    return NextResponse.json({ error: 'Plan is not currently available.' }, { status: 503 })
  }

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Reuse the user's existing Stripe customer if there is one.
  let customerId = auth.profile.stripe_customer_id
  if (!customerId) {
    const userResp = await stripe.customers.create({
      metadata: { user_id: auth.userId },
    })
    customerId = userResp.id
    const admin = getSupabaseAdmin()
    if (admin) {
      await admin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', auth.userId)
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${origin}/dashboard?upgrade=success`,
    cancel_url: `${origin}/pricing?upgrade=cancelled`,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    automatic_tax: { enabled: false },
    metadata: {
      user_id: auth.userId,
      plan: planId,
    },
    subscription_data: {
      metadata: {
        user_id: auth.userId,
        plan: planId,
      },
    },
  })

  trackServer({
    event_name: 'checkout_started',
    user_id: auth.userId,
    event_data: { plan: planId, price_usd: plan.priceUsd },
  }).catch(() => {})

  return NextResponse.json({ url: session.url })
}

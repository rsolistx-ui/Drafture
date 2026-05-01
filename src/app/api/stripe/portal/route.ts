import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { getStripe } from '@/lib/stripe'

/**
 * Opens the Stripe customer portal for the authenticated user.
 * Used for cancellation, payment-method updates, and invoice download.
 */
export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 })

  if (!auth.profile.stripe_customer_id) {
    return NextResponse.json({ error: 'No subscription on file.' }, { status: 400 })
  }

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await stripe.billingPortal.sessions.create({
    customer: auth.profile.stripe_customer_id,
    return_url: `${origin}/dashboard`,
  })

  return NextResponse.json({ url: session.url })
}

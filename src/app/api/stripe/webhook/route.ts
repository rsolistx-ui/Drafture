import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe, planFromPriceId, PLANS } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { trackServer } from '@/lib/analytics/events'

// Stripe needs the raw body for signature verification.
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 })
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 })
  }

  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${err instanceof Error ? err.message : 'unknown'}` }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    console.error(JSON.stringify({ event: 'webhook_no_admin', stripe_event: event.type }))
    return NextResponse.json({ received: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId   = (session.metadata?.user_id ?? null) as string | null
        const planMeta = (session.metadata?.plan ?? null) as string | null

        if (userId && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)
          const priceId = sub.items.data[0]?.price.id ?? null
          const planId = planMeta && PLANS[planMeta as keyof typeof PLANS] ? planMeta : planFromPriceId(priceId)
          const plan = PLANS[planId as keyof typeof PLANS]

          await admin
            .from('profiles')
            .update({
              plan: planId,
              plan_limit: plan.monthlyLimit,
              plan_status: sub.status,
              plan_renews_at: new Date(((sub as unknown as { current_period_end?: number }).current_period_end ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: sub.id,
            })
            .eq('id', userId)

          trackServer({
            event_name: 'subscription_created',
            user_id: userId,
            event_data: {
              plan: planId,
              price_usd: plan.priceUsd,
              stripe_subscription_id: sub.id,
              trial: sub.status === 'trialing',
            },
          }).catch(() => {})
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const priceId = sub.items.data[0]?.price.id ?? null
        const planId = planFromPriceId(priceId)
        const plan = PLANS[planId]

        await admin
          .from('profiles')
          .update({
            plan: planId,
            plan_limit: plan.monthlyLimit,
            plan_status: sub.status,
            plan_renews_at: new Date(((sub as unknown as { current_period_end?: number }).current_period_end ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
            stripe_subscription_id: sub.id,
          })
          .eq('stripe_customer_id', customerId)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string

        const { data: prof } = await admin
          .from('profiles')
          .select('id, plan, created_at')
          .eq('stripe_customer_id', customerId)
          .single()

        await admin
          .from('profiles')
          .update({
            plan: 'free',
            plan_limit: 3,
            plan_status: 'canceled',
            stripe_subscription_id: null,
            plan_renews_at: null,
          })
          .eq('stripe_customer_id', customerId)

        if (prof?.id) {
          trackServer({
            event_name: 'subscription_cancelled',
            user_id: prof.id,
            event_data: {
              plan: prof.plan,
              months_active: 0, // optional: compute from created_at if you care
            },
          }).catch(() => {})
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        await admin
          .from('profiles')
          .update({ plan_status: 'past_due' })
          .eq('stripe_customer_id', customerId)
        break
      }

      default:
        // Ignore everything else
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error(JSON.stringify({
      event: 'webhook_handler_error',
      stripe_event: event.type,
      error: err instanceof Error ? err.message : 'unknown',
    }))
    return NextResponse.json({ error: 'Handler error.' }, { status: 500 })
  }
}

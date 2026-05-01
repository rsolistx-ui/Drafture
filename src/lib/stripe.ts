/**
 * Stripe server client + plan config.
 *
 * Plan IDs come from env vars set in the Stripe Dashboard:
 *   STRIPE_PRICE_STARTER, STRIPE_PRICE_UNLIMITED
 *
 * This module is server-only. Never import in a client component.
 */

import Stripe from 'stripe'

let _client: Stripe | null = null

export function getStripe(): Stripe | null {
  if (_client) return _client
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key === 'your_stripe_secret_key' || key.startsWith('sk_live_or_test_')) return null
  // No explicit apiVersion: let the installed SDK pick its default. This avoids
  // type drift across SDK upgrades. To pin, set apiVersion to a literal that
  // matches your @stripe/stripe-node version.
  _client = new Stripe(key, { typescript: true })
  return _client
}

export type PlanId = 'free' | 'starter' | 'unlimited'

export interface PlanConfig {
  id: PlanId
  label: string
  monthlyLimit: number | null   // null = unlimited
  priceUsd: number
  stripePriceId: string | null  // null for free plan
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    label: 'Free',
    monthlyLimit: 3,
    priceUsd: 0,
    stripePriceId: null,
  },
  starter: {
    id: 'starter',
    label: 'Starter',
    monthlyLimit: 30,
    priceUsd: 9.99,
    stripePriceId: process.env.STRIPE_PRICE_STARTER ?? null,
  },
  unlimited: {
    id: 'unlimited',
    label: 'Unlimited',
    monthlyLimit: null,
    priceUsd: 19.99,
    stripePriceId: process.env.STRIPE_PRICE_UNLIMITED ?? null,
  },
}

/** Map a Stripe price ID back to a plan ID. Used by the webhook. */
export function planFromPriceId(priceId: string | null | undefined): PlanId {
  if (!priceId) return 'free'
  if (priceId === PLANS.starter.stripePriceId) return 'starter'
  if (priceId === PLANS.unlimited.stripePriceId) return 'unlimited'
  return 'free'
}

/** True if the env is wired well enough to attempt billing operations. */
export function isStripeConfigured(): boolean {
  return getStripe() !== null && !!process.env.STRIPE_WEBHOOK_SECRET
}

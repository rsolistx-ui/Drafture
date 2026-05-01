/**
 * DMD-060 — Health check endpoint
 * Used by uptime monitors (BetterStack, UptimeRobot).
 * Returns 200 when healthy, 503 when degraded.
 */

import { NextResponse } from 'next/server'

const APP_VERSION = process.env.npm_package_version ?? '0.1.0'
const PROMPT_VERSION = 'v1.2.0' // Keep in sync with PROMPT_VERSION in prompts.ts

interface ServiceStatus {
  ok: boolean
  latency_ms?: number
  error?: string
}

async function checkAnthropic(): Promise<ServiceStatus> {
  const start = Date.now()
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return { ok: false, error: 'ANTHROPIC_API_KEY not set' }
    }
    // Lightweight auth check — list models endpoint is fast and cheap
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(5000),
    })
    return {
      ok: res.ok,
      latency_ms: Date.now() - start,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    }
  } catch (err) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : 'unknown',
    }
  }
}

async function checkSupabase(): Promise<ServiceStatus> {
  const start = Date.now()
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'your_supabase_url') {
      return { ok: false, error: 'Supabase not configured' }
    }
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
      signal: AbortSignal.timeout(5000),
    })
    return {
      ok: res.status < 500,
      latency_ms: Date.now() - start,
    }
  } catch (err) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : 'unknown',
    }
  }
}

async function checkStripe(): Promise<ServiceStatus> {
  const start = Date.now()
  try {
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'your_stripe_secret_key') {
      return { ok: false, error: 'Stripe not configured' }
    }
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      },
      signal: AbortSignal.timeout(5000),
    })
    return {
      ok: res.ok,
      latency_ms: Date.now() - start,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    }
  } catch (err) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : 'unknown',
    }
  }
}

export async function GET() {
  const [anthropic, supabase, stripe] = await Promise.all([
    checkAnthropic(),
    checkSupabase(),
    checkStripe(),
  ])

  // Core service (Anthropic) must be healthy for the app to function
  const coreHealthy = anthropic.ok
  const allHealthy = anthropic.ok && supabase.ok && stripe.ok

  const body = {
    ok: coreHealthy,
    all_services_ok: allHealthy,
    version: APP_VERSION,
    prompt_version: PROMPT_VERSION,
    timestamp: new Date().toISOString(),
    services: {
      anthropic,
      supabase,
      stripe,
    },
  }

  return NextResponse.json(body, {
    status: coreHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

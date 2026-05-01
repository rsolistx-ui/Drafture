/**
 * Rate limiting via Upstash Redis.
 *
 * Install required packages:
 *   npm install @upstash/ratelimit @upstash/redis
 *
 * Set in .env.local (and Vercel project env vars):
 *   UPSTASH_REDIS_REST_URL=https://...
 *   UPSTASH_REDIS_REST_TOKEN=...
 * Get both from: https://console.upstash.com → your Redis database → REST API tab
 *
 * Graceful fallback: if Upstash is not configured, all requests are allowed
 * with a console warning. Safe for local dev; configure before public launch.
 *
 * Usage:
 *   import { rateLimit, LIMITS } from '@/lib/rate-limit'
 *   const result = await rateLimit(ip, LIMITS.generate)
 *   if (!result.allowed) return NextResponse.json({ error: result.message }, { status: 429 })
 */

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  reset: number          // Unix timestamp (seconds) when the window resets
  limit: number
  message?: string
}

export const LIMITS = {
  generate:  { requests: 10, window: '1 m' as const },   // 10 generations/min per IP — generous for a tool, strict enough to block abuse
  analytics: { requests: 60, window: '1 m' as const },   // 60 events/min per IP
  style:     { requests:  5, window: '1 m' as const },   // 5 style analyses/min per IP
  video:     { requests: 10, window: '1 m' as const },   // 10 video fetches/min per IP
  notes:     { requests:  5, window: '1 m' as const },   // 5 notes generations/min per IP
} as const

type LimitConfig = (typeof LIMITS)[keyof typeof LIMITS]

// Singleton clients (instantiated once per cold-start)
let _redis: import('@upstash/redis').Redis | null = null
let _limiters: Map<string, import('@upstash/ratelimit').Ratelimit> = new Map()
let _upstashConfigured = false
let _initAttempted = false

async function getUpstash(config: LimitConfig) {
  const key = `${config.requests}:${config.window}`

  if (_initAttempted && !_upstashConfigured) return null

  if (!_initAttempted) {
    _initAttempted = true
    const url   = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!url || !token || url === 'your_upstash_redis_url') {
      console.warn(
        JSON.stringify({
          event: 'rate_limit_unconfigured',
          message: 'Upstash not configured — rate limiting disabled. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN before launch.',
        })
      )
      return null
    }

    try {
      const { Redis } = await import('@upstash/redis')
      _redis = new Redis({ url, token })
      _upstashConfigured = true
    } catch {
      console.error(JSON.stringify({
        event: 'rate_limit_init_error',
        message: '@upstash/redis not installed. Run: npm install @upstash/ratelimit @upstash/redis',
      }))
      return null
    }
  }

  if (!_redis) return null

  if (!_limiters.has(key)) {
    try {
      const { Ratelimit } = await import('@upstash/ratelimit')
      _limiters.set(key, new Ratelimit({
        redis: _redis,
        limiter: Ratelimit.slidingWindow(config.requests, config.window),
        analytics: false,
        prefix: 'drafture_rl',
      }))
    } catch {
      return null
    }
  }

  return _limiters.get(key) ?? null
}

/**
 * Check and record a rate limit for the given identifier (IP address).
 *
 * @param identifier - IP address or user ID. Use req.headers.get('x-forwarded-for') ?? '127.0.0.1'
 * @param config     - One of LIMITS.generate / LIMITS.analytics / etc.
 */
export async function rateLimit(
  identifier: string,
  config: LimitConfig,
): Promise<RateLimitResult> {
  const limiter = await getUpstash(config)

  // Graceful allow if Upstash not configured
  if (!limiter) {
    return { allowed: true, remaining: config.requests, reset: 0, limit: config.requests }
  }

  try {
    const { success, limit, reset, remaining } = await limiter.limit(identifier)
    return {
      allowed: success,
      remaining,
      reset,
      limit,
      message: success ? undefined : `Too many requests. Try again in ${Math.ceil((reset * 1000 - Date.now()) / 1000)}s.`,
    }
  } catch (err) {
    // Redis error — fail open (don't block users due to rate-limit infra failure)
    console.error(JSON.stringify({
      event: 'rate_limit_error',
      error: err instanceof Error ? err.message : 'unknown',
    }))
    return { allowed: true, remaining: 1, reset: 0, limit: config.requests }
  }
}

/**
 * Extract the best available IP from Next.js request headers.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

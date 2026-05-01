/**
 * Client-side generation counter.
 *
 * Tracks how many posts the user has generated this month and all-time.
 * Data lives in localStorage until real auth + DB land (DMD-070).
 * The free plan limit (3/month) is enforced here for the usage meter;
 * the API does not enforce it yet — that comes with Stripe + auth.
 */

export const USAGE_STORAGE_KEY = 'drafture_usage_v1'

export const FREE_PLAN_LIMIT = 3

interface UsageRecord {
  allTime:     number
  monthKey:    string   // "YYYY-MM"
  monthCount:  number
}

function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function load(): UsageRecord {
  try {
    const raw = localStorage.getItem(USAGE_STORAGE_KEY)
    if (!raw) return { allTime: 0, monthKey: currentMonthKey(), monthCount: 0 }
    const parsed = JSON.parse(raw) as UsageRecord
    // Roll over if month changed
    const mk = currentMonthKey()
    if (parsed.monthKey !== mk) {
      return { allTime: parsed.allTime ?? 0, monthKey: mk, monthCount: 0 }
    }
    return parsed
  } catch {
    return { allTime: 0, monthKey: currentMonthKey(), monthCount: 0 }
  }
}

function save(record: UsageRecord): void {
  try {
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(record))
  } catch { /* quota error — silent */ }
}

/** Call once after every successful generation. */
export function recordGeneration(): void {
  const rec = load()
  save({ ...rec, allTime: rec.allTime + 1, monthCount: rec.monthCount + 1 })
}

/** Returns { monthCount, allTime, limit, remaining } for the dashboard. */
export function getUsage(): {
  monthCount:  number
  allTime:     number
  limit:       number
  remaining:   number
} {
  const rec = load()
  return {
    monthCount: rec.monthCount,
    allTime:    rec.allTime,
    limit:      FREE_PLAN_LIMIT,
    remaining:  Math.max(0, FREE_PLAN_LIMIT - rec.monthCount),
  }
}

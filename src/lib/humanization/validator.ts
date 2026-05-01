/**
 * DMD-002 — Pass 3 deterministic validator
 *
 * Regex-scans final output against the forbidden vocabulary database.
 * - ≤5 violations → surgical Haiku fix (fast, cheap: ~$0.0002)
 * - >5 violations → full humanizer re-run with Sonnet
 * - 0 violations → pass through unchanged
 *
 * This is the deterministic safety net that catches anything Pass 2 missed.
 */

import Anthropic from '@anthropic-ai/sdk'
import { FORBIDDEN_WORDS } from './forbidden-patterns'

const SURGICAL_FIX_THRESHOLD = 5

const SURGICAL_SYSTEM_PROMPT = `You are a precise text editor with one job: remove or replace specific flagged words and phrases in a discussion board post.

Rules:
- Replace ONLY the flagged items listed. Nothing else.
- Find a natural substitute that fits the context (e.g., "furthermore" → "and", "pivotal" → "important", "leverage" → "use", "facilitate" → "help", "nuanced" → "specific")
- Do NOT rewrite sentences unless the replacement makes the grammar wrong
- Do NOT add new AI-flagged vocabulary as replacements
- Do NOT change the meaning, argument, or tone
- Return ONLY the corrected post text`

/**
 * Build a case-insensitive word-boundary regex for a phrase or word.
 * Handles multi-word phrases and single words safely.
 */
function buildPattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Use word boundaries for single words, lookahead/lookbehind for phrases
  const pattern = term.includes(' ')
    ? `(?<![\\w])${escaped}(?![\\w])`
    : `\\b${escaped}\\b`
  return new RegExp(pattern, 'gi')
}

export interface ValidationResult {
  violations: string[]
  violationCount: number
  clean: boolean
}

/**
 * Scans text for forbidden vocabulary.
 * Returns each unique violation found (not duplicates).
 */
export function scanForViolations(text: string): ValidationResult {
  const found = new Set<string>()

  for (const term of FORBIDDEN_WORDS) {
    try {
      const pattern = buildPattern(term)
      if (pattern.test(text)) {
        found.add(term)
      }
    } catch {
      // Malformed pattern — skip silently, log for monitoring
      console.warn(`Invalid forbidden pattern: ${term}`)
    }
  }

  const violations = Array.from(found)
  return {
    violations,
    violationCount: violations.length,
    clean: violations.length === 0,
  }
}

/**
 * Surgical Haiku fix for ≤5 violations.
 * Fast (~1s) and cheap (~$0.0002).
 */
export async function surgicalFix(
  client: Anthropic,
  text: string,
  violations: string[],
): Promise<string> {
  const violationList = violations.map(v => `"${v}"`).join(', ')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 600,
    temperature: 0.3,
    system: SURGICAL_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Remove or replace these flagged words/phrases: ${violationList}\n\nPOST:\n${text}`,
      },
    ],
  })

  return response.content[0].type === 'text'
    ? response.content[0].text.trim()
    : text // fall back to original if something goes wrong
}

/**
 * Main validator entry point.
 * Returns the (possibly corrected) text and metadata.
 */
export async function validateAndFix(
  client: Anthropic,
  text: string,
  fullRerunCallback: (text: string) => Promise<string>,
): Promise<{
  text: string
  violations: string[]
  fixMethod: 'none' | 'surgical' | 'full_rerun'
}> {
  const scan = scanForViolations(text)

  if (scan.clean) {
    return { text, violations: [], fixMethod: 'none' }
  }

  // Log for monitoring (DMD-004 will store these in DB)
  console.log(
    JSON.stringify({
      event: 'validator_violations',
      count: scan.violationCount,
      violations: scan.violations,
      fix_method: scan.violationCount <= SURGICAL_FIX_THRESHOLD ? 'surgical' : 'full_rerun',
    })
  )

  if (scan.violationCount <= SURGICAL_FIX_THRESHOLD) {
    const fixed = await surgicalFix(client, text, scan.violations)
    // Verify the fix actually worked
    const recheck = scanForViolations(fixed)
    return {
      text: recheck.clean ? fixed : text, // if fix failed, ship original rather than making it worse
      violations: scan.violations,
      fixMethod: 'surgical',
    }
  }

  // >5 violations: full humanizer re-run
  const rerun = await fullRerunCallback(text)
  return {
    text: rerun,
    violations: scan.violations,
    fixMethod: 'full_rerun',
  }
}

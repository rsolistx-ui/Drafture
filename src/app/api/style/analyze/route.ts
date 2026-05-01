/**
 * DMD-017 — Style fingerprint extraction endpoint.
 *
 * Accepts 1–3 writing samples, calls Claude Haiku to extract a
 * StyleFingerprint, and returns it for localStorage persistence on the client.
 *
 * Rate limited: 5 requests/min per IP (style analyses are cheap but
 * shouldn't be spammable — extraction is a one-time setup action).
 */

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  STYLE_EXTRACT_SYSTEM_PROMPT,
  buildStyleExtractPrompt,
  parseStyleResponse,
} from '@/lib/style/extract'
import { rateLimit, getClientIp, LIMITS } from '@/lib/rate-limit'
import type { StyleFingerprint } from '@/lib/style/types'
import { MIN_SAMPLE_CHARS } from '@/lib/style/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(req: Request) {
  // ── Rate limiting ─────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  const rl = await rateLimit(ip, LIMITS.style)
  if (!rl.allowed) {
    return NextResponse.json({ error: rl.message }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { samples } = body

    if (!Array.isArray(samples) || samples.length === 0) {
      return NextResponse.json(
        { error: 'samples must be a non-empty array of strings' },
        { status: 400 }
      )
    }

    // Count valid (long enough) samples before building the prompt
    const validSamples = (samples as string[]).filter(
      (s) => typeof s === 'string' && s.trim().length >= MIN_SAMPLE_CHARS
    )

    if (validSamples.length === 0) {
      return NextResponse.json(
        { error: `Each writing sample must be at least ${MIN_SAMPLE_CHARS} characters. Paste a longer excerpt.` },
        { status: 400 }
      )
    }

    // Build the prompt (handles truncation internally)
    const userMessage = buildStyleExtractPrompt(validSamples)

    // ── Claude Haiku — pattern extraction, not creative work ──────────────
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      temperature: 0.2, // Low — consistent JSON output is the goal
      system: STYLE_EXTRACT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw =
      response.content[0].type === 'text' ? response.content[0].text : ''

    const parsed = parseStyleResponse(raw)

    if (!parsed) {
      console.error(
        JSON.stringify({
          event: 'style_parse_failed',
          raw_length: raw.length,
          raw_preview: raw.slice(0, 200),
        })
      )
      return NextResponse.json(
        {
          error:
            'Could not extract a style fingerprint. Try pasting a longer, more complete writing sample (at least 3–4 full sentences).',
        },
        { status: 422 }
      )
    }

    const fingerprint: StyleFingerprint = {
      ...parsed,
      extracted_at: new Date().toISOString(),
      sample_count: validSamples.length,
    }

    console.log(
      JSON.stringify({
        event: 'style_extracted',
        sample_count: fingerprint.sample_count,
        sentence_rhythm: fingerprint.sentence_rhythm,
        vocabulary_register: fingerprint.vocabulary_register,
        avg_sentence_length: fingerprint.avg_sentence_length,
        timestamp: fingerprint.extracted_at,
      })
    )

    return NextResponse.json({ fingerprint })
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'style_analysis_error',
        error: error instanceof Error ? error.message : 'unknown',
      })
    )
    return NextResponse.json(
      { error: 'Failed to analyze writing style. Please try again.' },
      { status: 500 }
    )
  }
}

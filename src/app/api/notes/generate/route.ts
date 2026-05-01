import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { NOTES_SYSTEM_PROMPT, NOTES_PROMPT_VERSION } from '@/lib/notes/prompts'
import { rateLimit, getClientIp, LIMITS } from '@/lib/rate-limit'
import { checkSpendGuard, recordGenerationSpend } from '@/lib/spend-guard'
import { calculatePassCost } from '@/lib/costs'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const MODEL = 'claude-sonnet-4-6'

// Max 3 PDFs per request, each up to ~15MB base64 (~11MB raw)
const MAX_PDFS = 3
const MAX_BASE64_BYTES = 20 * 1024 * 1024 // 20MB per PDF (base64)

export async function POST(req: Request) {
  // ── Rate limiting ───────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  const rl = await rateLimit(ip, LIMITS.notes)
  if (!rl.allowed) {
    return NextResponse.json({ error: rl.message }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { pdfs, course } = body as {
      pdfs: Array<{ base64: string; name: string }>
      course?: string
    }

    // ── Input validation ─────────────────────────────────────────────────────
    if (!Array.isArray(pdfs) || pdfs.length === 0) {
      return NextResponse.json({ error: 'At least one PDF is required.' }, { status: 400 })
    }

    if (pdfs.length > MAX_PDFS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_PDFS} PDFs per request.` },
        { status: 400 }
      )
    }

    for (const pdf of pdfs) {
      if (!pdf.base64 || typeof pdf.base64 !== 'string' || pdf.base64.length === 0) {
        return NextResponse.json({ error: 'Invalid PDF data.' }, { status: 400 })
      }
      if (pdf.base64.length > MAX_BASE64_BYTES) {
        return NextResponse.json(
          { error: `PDF "${pdf.name}" is too large. Maximum size is ~15MB.` },
          { status: 400 }
        )
      }
    }

    // ── Spend guard ──────────────────────────────────────────────────────────
    const spendCheck = await checkSpendGuard()
    if (!spendCheck.allowed) {
      return NextResponse.json(
        { error: spendCheck.reason ?? 'Service temporarily unavailable. Please try again later.' },
        { status: 503 }
      )
    }

    // ── Build message content: PDF document blocks + text prompt ─────────────
    const courseContext = course?.trim()
      ? `\n\nCourse context: ${course.trim()}`
      : ''

    const textPrompt = pdfs.length === 1
      ? `Please generate comprehensive academic study notes from the uploaded document (${pdfs[0].name}).${courseContext}`
      : `Please generate comprehensive academic study notes from the ${pdfs.length} uploaded documents (${pdfs.map(p => p.name).join(', ')}).${courseContext} Organize the notes to cover all documents coherently — if the documents relate to the same topic, integrate them; if they cover different topics, use clear section breaks.`

    type ContentBlock =
      | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
      | { type: 'text'; text: string }

    const contentBlocks: ContentBlock[] = [
      ...pdfs.map((pdf): ContentBlock => ({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: pdf.base64,
        },
      })),
      { type: 'text', text: textPrompt },
    ]

    // ── Call Claude ───────────────────────────────────────────────────────────
    const start = Date.now()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: NOTES_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
    })

    const elapsed = Date.now() - start

    const notes =
      response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    if (!notes) {
      return NextResponse.json({ error: 'Notes generation failed.' }, { status: 500 })
    }

    // ── Cost accounting ───────────────────────────────────────────────────────
    const cost = calculatePassCost(
      MODEL,
      response.usage.input_tokens,
      response.usage.output_tokens,
    )

    await recordGenerationSpend(cost.costUsd)

    console.log(
      JSON.stringify({
        event: 'notes_generated',
        prompt_version: NOTES_PROMPT_VERSION,
        pdf_count: pdfs.length,
        model: MODEL,
        tokens: { in: cost.inputTokens, out: cost.outputTokens },
        cost_usd: cost.costUsd.toFixed(6),
        elapsed_ms: elapsed,
        timestamp: new Date().toISOString(),
      })
    )

    return NextResponse.json({
      notes,
      pdfCount: pdfs.length,
      costUsd: parseFloat(cost.costUsd.toFixed(6)),
      totalMs: elapsed,
    })
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'notes_generation_error',
        error: error instanceof Error ? error.message : 'unknown',
        timestamp: new Date().toISOString(),
      })
    )
    return NextResponse.json({ error: 'Failed to generate notes.' }, { status: 500 })
  }
}

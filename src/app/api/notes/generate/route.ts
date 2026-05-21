import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { NOTES_SYSTEM_PROMPT, NOTES_PROMPT_VERSION } from '@/lib/notes/prompts'
import { rateLimit, getClientIp, LIMITS } from '@/lib/rate-limit'
import { checkSpendGuard, recordGenerationSpend } from '@/lib/spend-guard'
import { runPrimaryWithSafetyEngine } from '@/lib/writing-engine'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const MODEL = 'claude-sonnet-4-6'

// Max 3 PDFs per request, each up to ~15MB base64 (~11MB raw)
const MAX_PDFS = 3
const MAX_BASE64_BYTES = 20 * 1024 * 1024 // 20MB per PDF (base64)

type ContentBlock =
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
  | { type: 'text'; text: string }

export async function POST(req: Request) {
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

    if (!Array.isArray(pdfs) || pdfs.length === 0) {
      return NextResponse.json({ error: 'At least one PDF is required.' }, { status: 400 })
    }

    if (pdfs.length > MAX_PDFS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_PDFS} PDFs per request.` },
        { status: 400 },
      )
    }

    for (const pdf of pdfs) {
      if (!pdf.base64 || typeof pdf.base64 !== 'string' || pdf.base64.length === 0) {
        return NextResponse.json({ error: 'Invalid PDF data.' }, { status: 400 })
      }
      if (pdf.base64.length > MAX_BASE64_BYTES) {
        return NextResponse.json(
          { error: `PDF "${pdf.name}" is too large. Maximum size is ~15MB.` },
          { status: 400 },
        )
      }
    }

    const spendCheck = await checkSpendGuard()
    if (!spendCheck.allowed) {
      return NextResponse.json(
        { error: spendCheck.reason ?? 'Service temporarily unavailable. Please try again later.' },
        { status: 503 },
      )
    }

    const courseContext = course?.trim()
      ? `\n\nCourse context: ${course.trim()}`
      : ''

    const textPrompt = pdfs.length === 1
      ? `Please generate comprehensive academic study notes from the uploaded document (${pdfs[0].name}).${courseContext}`
      : `Please generate comprehensive academic study notes from the ${pdfs.length} uploaded documents (${pdfs.map(p => p.name).join(', ')}).${courseContext} Organize the notes to cover all documents coherently. If the documents relate to the same topic, integrate them; if they cover different topics, use clear section breaks.`

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

    const start = Date.now()
    const result = await runPrimaryWithSafetyEngine({
      client,
      system: NOTES_SYSTEM_PROMPT,
      content: contentBlocks,
      targetLabel: 'academic study notes',
      maxTokens: 4000,
      temperature: 0.7,
      startedAt: start,
    })

    await recordGenerationSpend(result.costs.totalCostUsd)

    console.log(
      JSON.stringify({
        event: 'notes_generated',
        prompt_version: NOTES_PROMPT_VERSION,
        writing_engine_version: result.promptVersion,
        pdf_count: pdfs.length,
        model: MODEL,
        model_humanizer: result.modelHumanizer,
        pass1_tokens: { in: result.costs.pass1.inputTokens, out: result.costs.pass1.outputTokens },
        pass2_tokens: { in: result.costs.pass2.inputTokens, out: result.costs.pass2.outputTokens },
        violations_found: result.validation.violations.length,
        fix_method: result.validation.fixMethod,
        cost_usd: result.costs.totalCostUsd.toFixed(6),
        elapsed_ms: Date.now() - start,
        timing_ms: result.timings,
        timestamp: new Date().toISOString(),
      }),
    )

    return NextResponse.json({
      notes: result.content,
      pdfCount: pdfs.length,
      violationsFound: result.validation.violations.length,
      fixMethod: result.validation.fixMethod,
      costUsd: parseFloat(result.costs.totalCostUsd.toFixed(6)),
      totalMs: result.timings.total,
    })
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'notes_generation_error',
        error: error instanceof Error ? error.message : 'unknown',
        timestamp: new Date().toISOString(),
      }),
    )
    return NextResponse.json({ error: 'Failed to generate notes.' }, { status: 500 })
  }
}

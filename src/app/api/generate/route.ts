import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  DRAFT_SYSTEM_PROMPT,
  CLASSMATE_REPLY_SYSTEM_PROMPT,
  INSTRUCTOR_REPLY_SYSTEM_PROMPT,
  HUMANIZER_SYSTEM_PROMPT,
  PROMPT_VERSION,
  buildDraftPrompt,
  buildHumanizerPrompt,
} from '@/lib/humanization/prompts'
import { validateAndFix } from '@/lib/humanization/validator'
import {
  selfEvalAndCorrect,
  buildRefinementPrompt,
  EVAL_MODEL,
  CORRECT_MODEL,
} from '@/lib/humanization/self-eval'
import { calculatePassCost, sumCosts } from '@/lib/costs'
import { checkSpendGuard, recordGenerationSpend } from '@/lib/spend-guard'
import { trackServer } from '@/lib/analytics/events'
import { rateLimit, getClientIp, LIMITS } from '@/lib/rate-limit'
import { getCurrentProfile } from '@/lib/supabase-server'
import { checkAndIncrementUsage, decrementUsage } from '@/lib/plan'
import type { StyleFingerprint } from '@/lib/style/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const MODEL_DRAFT     = 'claude-sonnet-4-6'
const MODEL_HUMANIZER = 'claude-sonnet-4-6'

const DEFAULT_WORD_COUNT_TARGETS: Record<string, { min: number; max: number }> = {
  initial:    { min: 250, max: 400 },
  classmate:  { min: 50,  max: 200 },
  instructor: { min: 100, max: 150 },
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function wordCountStatus(text: string, min: number, max: number) {
  const count = countWords(text)
  return { inRange: count >= min && count <= max, count, target: `${min}-${max} words` }
}

export async function POST(req: Request) {
  const generationStart = Date.now()

  // ── Auth: every generation must belong to a real user ──────────────────────
  const profileBundle = await getCurrentProfile()
  if (!profileBundle) {
    return NextResponse.json({ error: 'Please log in to generate.' }, { status: 401 })
  }
  const userId = profileBundle.user.id
  const profile = profileBundle.profile as { plan: string; plan_status: string; honor_code_accepted_at: string | null }

  // Honor code gate. Hard required by the panel before any generation.
  if (!profile.honor_code_accepted_at) {
    return NextResponse.json(
      { error: 'Please accept the academic honor code in your dashboard before generating.' },
      { status: 403 }
    )
  }

  // Past-due subscriptions get blocked from paid features.
  if (profile.plan_status === 'past_due') {
    return NextResponse.json(
      { error: 'Your subscription payment failed. Please update your card in billing.' },
      { status: 402 }
    )
  }

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  const rl = await rateLimit(`gen:${userId}:${ip}`, LIMITS.generate)
  if (!rl.allowed) {
    return NextResponse.json({ error: rl.message }, { status: 429 })
  }

  // ── Server-side plan + monthly usage enforcement ───────────────────────────
  const usage = await checkAndIncrementUsage(userId)
  if (!usage.allowed) {
    trackServer({
      event_name: 'post_limit_hit',
      user_id: userId,
      event_data: {
        plan: profile.plan,
        posts_used: usage.count,
        posts_limit: usage.limit ?? 0,
      },
    }).catch(() => {})
    return NextResponse.json(
      { error: usage.reason ?? 'Monthly limit reached.', limit: usage.limit, count: usage.count },
      { status: 402 }
    )
  }

  try {
    const {
      prompt, postType, tone, course,
      classmatePost, professorCriteria, videoSummary,
      minWords, maxWords,
      styleFingerprint,    // optional: StyleFingerprint from localStorage (DMD-018)
      sessionId,           // optional: client session UUID
      instructorPdfBase64, // optional: base64 PDF attached to classmate/instructor reply
      courseNotes,         // optional: saved notes snippet from the notes library
      refineFeedback,      // optional: student feedback for a refinement pass
      previousDraft,       // optional: existing draft to refine (paired with refineFeedback)
    } = await req.json()

    if (!prompt?.trim()) {
      // Refund the usage tick since we never called Anthropic.
      await decrementUsage(userId)
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // ── DMD-010: Daily spend kill-switch ─────────────────────────────────────
    const spendCheck = await checkSpendGuard()
    if (!spendCheck.allowed) {
      await decrementUsage(userId)
      return NextResponse.json(
        { error: spendCheck.reason ?? 'Service temporarily unavailable. Please try again later.' },
        { status: 503 }
      )
    }

    const resolvedPostType: 'initial' | 'classmate' | 'instructor' =
      postType === 'classmate'  ? 'classmate'  :
      postType === 'instructor' ? 'instructor' :
      'initial'

    const systemPrompt =
      resolvedPostType === 'classmate'  ? CLASSMATE_REPLY_SYSTEM_PROMPT  :
      resolvedPostType === 'instructor' ? INSTRUCTOR_REPLY_SYSTEM_PROMPT :
      DRAFT_SYSTEM_PROMPT

    const defaults = DEFAULT_WORD_COUNT_TARGETS[resolvedPostType] ?? DEFAULT_WORD_COUNT_TARGETS.initial
    const wordMin = (typeof minWords === 'number' && minWords >= 25) ? minWords : defaults.min
    const wordMax = (typeof maxWords === 'number' && maxWords >= wordMin) ? maxWords : defaults.max
    const wordTarget = { min: wordMin, max: wordMax }

    // ── Validate styleFingerprint if provided ─────────────────────────────────
    const resolvedStyle: StyleFingerprint | null =
      styleFingerprint &&
      typeof styleFingerprint === 'object' &&
      typeof styleFingerprint.sentence_rhythm === 'string'
        ? (styleFingerprint as StyleFingerprint)
        : null

    const hasPdf =
      typeof instructorPdfBase64 === 'string' &&
      instructorPdfBase64.length > 0 &&
      (resolvedPostType === 'classmate' || resolvedPostType === 'instructor')

    const isRefinement =
      typeof refineFeedback === 'string' && refineFeedback.trim().length > 0 &&
      typeof previousDraft   === 'string' && previousDraft.trim().length > 0

    // ── Shared: cost accumulators ─────────────────────────────────────────────
    let pass1Cost = calculatePassCost(MODEL_DRAFT, 0, 0)
    let pass2Cost = calculatePassCost(MODEL_HUMANIZER, 0, 0)
    let pass1Ms = 0, pass2Ms = 0, pass3Ms = 0

    let preValidationText: string

    if (isRefinement) {
      // ── REFINEMENT PATH: targeted revision of existing draft ─────────────────
      // Skip Pass 1 + Pass 2 (base is already humanized). Run one targeted
      // revision pass so the student's feedback is addressed precisely.
      const refineMsg = buildRefinementPrompt(
        previousDraft as string,
        (refineFeedback as string).trim(),
        `${wordTarget.min}-${wordTarget.max} words`,
      )
      const refineStart = Date.now()
      const refineResponse = await client.messages.create({
        model:       MODEL_HUMANIZER,
        max_tokens:  900,
        temperature: 0.4,
        system:      HUMANIZER_SYSTEM_PROMPT,
        messages:    [{ role: 'user', content: refineMsg }],
      })
      pass1Ms = Date.now() - refineStart
      pass1Cost = calculatePassCost(
        MODEL_HUMANIZER,
        refineResponse.usage.input_tokens,
        refineResponse.usage.output_tokens,
      )
      preValidationText = refineResponse.content[0].type === 'text'
        ? refineResponse.content[0].text.trim()
        : previousDraft as string

    } else {
      // ── NORMAL PATH: full two-pass generation ─────────────────────────────────

      // Pass 1: Draft generation (temperature 1.0 for max perplexity)
      const pass1Start = Date.now()
      const draftUserMessage = buildDraftPrompt({
        professorPrompt:  prompt,
        postType:         resolvedPostType,
        tone:             tone || 'thoughtful',
        course:           course || undefined,
        classmatePost:    classmatePost || undefined,
        instructorPost:   resolvedPostType === 'instructor' ? classmatePost : undefined,
        professorCriteria: professorCriteria || undefined,
        videoSummary:     videoSummary || undefined,
        courseNotes:      typeof courseNotes === 'string' && courseNotes.trim() ? courseNotes.trim() : undefined,
        wordMin,
        wordMax,
        styleFingerprint: resolvedStyle,
      })

      type Pass1Content =
        | string
        | Array<
            | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
            | { type: 'text'; text: string }
          >

      const pass1Content: Pass1Content = hasPdf
        ? [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: instructorPdfBase64 as string },
            },
            { type: 'text', text: draftUserMessage },
          ]
        : draftUserMessage

      const draftResponse = await client.messages.create({
        model:       MODEL_DRAFT,
        max_tokens:  900,
        temperature: 1,  // DMD-001: keep at 1.0 for max perplexity
        system:      systemPrompt,
        messages:    [{ role: 'user', content: pass1Content }],
      })

      pass1Cost = calculatePassCost(
        MODEL_DRAFT,
        draftResponse.usage.input_tokens,
        draftResponse.usage.output_tokens,
      )
      pass1Ms = Date.now() - pass1Start

      const draft = draftResponse.content[0].type === 'text'
        ? draftResponse.content[0].text.trim()
        : ''

      if (!draft) {
        return NextResponse.json({ error: 'Generation failed on draft pass' }, { status: 500 })
      }

      // Pass 2: Adversarial humanizer (temperature 0.4 — deterministic editor)
      const pass2Start = Date.now()
      const humanizerMessage = buildHumanizerPrompt(
        draft,
        resolvedPostType,
        `${wordTarget.min}-${wordTarget.max} words`,
      )
      const humanizedResponse = await client.messages.create({
        model:       MODEL_HUMANIZER,
        max_tokens:  900,
        temperature: 0.4,
        system:      HUMANIZER_SYSTEM_PROMPT,
        messages:    [{ role: 'user', content: humanizerMessage }],
      })

      pass2Cost = calculatePassCost(
        MODEL_HUMANIZER,
        humanizedResponse.usage.input_tokens,
        humanizedResponse.usage.output_tokens,
      )
      pass2Ms = Date.now() - pass2Start

      preValidationText = humanizedResponse.content[0].type === 'text'
        ? humanizedResponse.content[0].text.trim()
        : draft
    }

    // ── Pass 3: Deterministic validator + surgical fix (DMD-002) ─────────────
    const pass3Start = Date.now()

    const fullRerunCallback = async (text: string): Promise<string> => {
      const rerunMsg = buildHumanizerPrompt(text, resolvedPostType, `${wordTarget.min}-${wordTarget.max} words`)
      const rerun = await client.messages.create({
        model: MODEL_HUMANIZER, max_tokens: 900, temperature: 0.4,
        system: HUMANIZER_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: rerunMsg }],
      })
      return rerun.content[0].type === 'text' ? rerun.content[0].text.trim() : text
    }

    const validationResult = await validateAndFix(client, preValidationText, fullRerunCallback)
    pass3Ms = Date.now() - pass3Start

    // ── Pass 4: Self-evaluation + targeted correction ─────────────────────────
    // Internal quality gate — student never sees the eval, only the final result.
    // Haiku scores on 5 criteria; Sonnet fixes if < 7/10.
    const pass4Start = Date.now()
    const evalResult = await selfEvalAndCorrect(
      client,
      validationResult.text,
      resolvedPostType,
      prompt,
      `${wordTarget.min}-${wordTarget.max} words`,
    )
    const pass4Ms = Date.now() - pass4Start

    const content = evalResult.text

    // ── Cost aggregation (all passes) ─────────────────────────────────────────
    const evalCost = calculatePassCost(
      EVAL_MODEL,
      evalResult.evalTokens.input,
      evalResult.evalTokens.output,
    )
    const fixCost = evalResult.fixTokens
      ? calculatePassCost(CORRECT_MODEL, evalResult.fixTokens.input, evalResult.fixTokens.output)
      : calculatePassCost(CORRECT_MODEL, 0, 0)

    const costs = sumCosts([pass1Cost, pass2Cost, evalCost, fixCost])
    const totalMs = Date.now() - generationStart

    // ── DMD-010: Record actual spend ──────────────────────────────────────────
    await recordGenerationSpend(costs.totalCostUsd)

    // ── Structured generation log ─────────────────────────────────────────────
    console.log(
      JSON.stringify({
        event:            isRefinement ? 'refinement_complete' : 'generation_complete',
        prompt_version:   PROMPT_VERSION,
        post_type:        resolvedPostType,
        is_refinement:    isRefinement,
        model_draft:      MODEL_DRAFT,
        model_humanizer:  MODEL_HUMANIZER,
        pass1_tokens:     { in: pass1Cost.inputTokens,  out: pass1Cost.outputTokens  },
        pass2_tokens:     { in: pass2Cost.inputTokens,  out: pass2Cost.outputTokens  },
        eval_scores:      evalResult.evalBefore.scores,
        eval_total:       evalResult.evalBefore.total,
        eval_passed:      evalResult.evalBefore.pass,
        eval_corrected:   evalResult.corrected,
        eval_after_total: evalResult.evalAfter?.total ?? null,
        total_cost_usd:   costs.totalCostUsd.toFixed(6),
        violations_found: validationResult.violations.length,
        fix_method:       validationResult.fixMethod,
        word_count:       countWords(content),
        word_target:      `${wordMin}-${wordMax}`,
        style_active:     !!resolvedStyle,
        had_pdf:          hasPdf,
        had_course_notes: typeof courseNotes === 'string' && courseNotes.trim().length > 0,
        timing_ms: { pass1: pass1Ms, pass2: pass2Ms, pass3: pass3Ms, pass4: pass4Ms, total: totalMs },
        timestamp:        new Date().toISOString(),
      })
    )

    // ── Word count validation ─────────────────────────────────────────────────
    const wcStatus = wordCountStatus(content, wordTarget.min, wordTarget.max)

    // ── DMD-097: Fire analytics event ────────────────────────────────────────
    trackServer({
      event_name: 'post_generated',
      user_id:    userId,
      session_id: typeof sessionId === 'string' ? sessionId : undefined,
      prompt_version: PROMPT_VERSION,
      event_data: {
        post_type:          resolvedPostType,
        tone:               tone || 'thoughtful',
        word_count:         wcStatus.count,
        word_target_min:    wordMin,
        word_target_max:    wordMax,
        word_count_in_range: wcStatus.inRange,
        had_video_summary:  !!(videoSummary?.trim()),
        had_criteria:       !!(professorCriteria?.trim()),
        had_classmate_post: !!(classmatePost?.trim()),
        had_course:         !!(course?.trim()),
        violations_found:   validationResult.violations.length,
        fix_method:         validationResult.fixMethod,
        cost_usd:           parseFloat(costs.totalCostUsd.toFixed(6)),
        total_ms:           totalMs,
        prompt_version:     PROMPT_VERSION,
      },
    }).catch(() => { /* analytics never blocks generation */ })

    return NextResponse.json({
      content,
      wordCount:       wcStatus.count,
      wordTarget:      wcStatus.target,
      wordCountInRange: wcStatus.inRange,
      violationsFound: validationResult.violations.length,
      fixMethod:       validationResult.fixMethod,
      promptVersion:   PROMPT_VERSION,
      costUsd:         parseFloat(costs.totalCostUsd.toFixed(6)),
      totalMs,
      // Plan + usage telemetry for the dashboard meter
      monthCount:      usage.count,
      monthLimit:      usage.limit,
      // Self-eval metadata (for dev transparency, not shown to students)
      evalScore:       evalResult.evalBefore.total,
      evalCorrected:   evalResult.corrected,
      isRefinement,
    })

  } catch (error) {
    // Refund the usage tick on Anthropic / runtime failure.
    await decrementUsage(userId)
    console.error(
      JSON.stringify({
        event: 'generation_error',
        error: error instanceof Error ? error.message : 'unknown',
        timestamp: new Date().toISOString(),
      })
    )
    return NextResponse.json({ error: 'Failed to generate post' }, { status: 500 })
  }
}

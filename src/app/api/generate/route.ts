import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { checkSpendGuard, recordGenerationSpend } from '@/lib/spend-guard'
import { trackServer } from '@/lib/analytics/events'
import { rateLimit, getClientIp, LIMITS } from '@/lib/rate-limit'
import { getCurrentProfile } from '@/lib/supabase-server'
import { checkAndIncrementUsage, decrementUsage } from '@/lib/plan'
import {
  countWords,
  resolvePostType,
  resolveStyleFingerprint,
  resolveWordTarget,
  runDiscussionWritingEngine,
  wordCountStatus,
} from '@/lib/writing-engine'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const INPUT_LIMITS = {
  prompt: 8000,
  classmatePost: 8000,
  professorCriteria: 6000,
  videoSummary: 10000,
  courseNotes: 12000,
  refineFeedback: 2500,
  previousDraft: 6000,
  course: 160,
  pdfBase64Chars: 20_000_000,
}

function textLength(value: unknown): number {
  return typeof value === 'string' ? value.trim().length : 0
}

function overLimit(value: unknown, limit: number): boolean {
  return textLength(value) > limit
}

function validateGeneratePayload(payload: Record<string, unknown>): string | null {
  if (overLimit(payload.prompt, INPUT_LIMITS.prompt)) return 'Prompt is too long. Trim it and try again.'
  if (overLimit(payload.classmatePost, INPUT_LIMITS.classmatePost)) return 'Classmate or instructor text is too long. Trim it and try again.'
  if (overLimit(payload.professorCriteria, INPUT_LIMITS.professorCriteria)) return 'Rubric or criteria text is too long. Trim it and try again.'
  if (overLimit(payload.videoSummary, INPUT_LIMITS.videoSummary)) return 'Video notes are too long. Trim them and try again.'
  if (overLimit(payload.courseNotes, INPUT_LIMITS.courseNotes)) return 'Course notes are too long. Select a smaller notes set.'
  if (overLimit(payload.refineFeedback, INPUT_LIMITS.refineFeedback)) return 'Refinement request is too long. Keep it specific.'
  if (overLimit(payload.previousDraft, INPUT_LIMITS.previousDraft)) return 'Previous draft is too long to refine safely.'
  if (overLimit(payload.course, INPUT_LIMITS.course)) return 'Course name is too long.'
  if (overLimit(payload.instructorPdfBase64, INPUT_LIMITS.pdfBase64Chars)) return 'PDF is too large. Maximum size is 15MB.'
  return null
}

function buildReadinessPacket(params: {
  postType: string
  wordCount: number
  wordTarget: string
  wordCountInRange: boolean
  hadCourseNotes: boolean
  hadVideoSummary: boolean
  hadCriteria: boolean
  hadClassmatePost: boolean
  hadPdf: boolean
  hadStyle: boolean
}) {
  const sourceUse = [
    'Professor prompt',
    params.hadCriteria ? 'Rubric or grading criteria' : null,
    params.hadCourseNotes ? 'Saved course notes' : null,
    params.hadVideoSummary ? 'Video summary' : null,
    params.hadClassmatePost ? 'Classmate or instructor text' : null,
    params.hadPdf ? 'Attached PDF' : null,
    params.hadStyle ? 'Saved style profile' : null,
  ].filter(Boolean) as string[]

  const revisionChecks = [
    params.wordCountInRange
      ? `Word count is in range at ${params.wordCount} words.`
      : `Word count is ${params.wordCount}; target is ${params.wordTarget}. Adjust before submitting.`,
    'Add one detail only you would know if the draft still feels too general.',
    'Verify every factual claim against your course material before submitting.',
    params.postType === 'classmate'
      ? 'Make sure the reply names something specific from the classmate, not just the topic.'
      : params.postType === 'instructor'
        ? 'Make sure the reply answers the instructor directly before adding a new idea.'
        : 'Make sure the main point is something you can explain without reading the draft.',
  ]

  const explainBackQuestions = [
    'What is the main claim in one sentence?',
    'Which sentence sounds least like you, and how would you rewrite it?',
    'What course concept or example would you point to if asked where the idea came from?',
  ]

  return {
    sourceUse,
    revisionChecks,
    explainBackQuestions,
  }
}

export async function POST(req: Request) {
  const generationStart = Date.now()

  // Auth: every generation must belong to a real user.
  const profileBundle = await getCurrentProfile()
  if (!profileBundle) {
    return NextResponse.json({ error: 'Please log in to generate.' }, { status: 401 })
  }
  const userId = profileBundle.user.id
  const profile = profileBundle.profile as { plan: string; plan_status: string }

  if (profile.plan_status === 'past_due') {
    return NextResponse.json(
      { error: 'Your subscription payment failed. Please update your card in billing.' },
      { status: 402 },
    )
  }

  const ip = getClientIp(req)
  const rl = await rateLimit(`gen:${userId}:${ip}`, LIMITS.generate)
  if (!rl.allowed) {
    return NextResponse.json({ error: rl.message }, { status: 429 })
  }

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
      { status: 402 },
    )
  }

  try {
    const body = await req.json()
    const payloadError = validateGeneratePayload(body as Record<string, unknown>)
    if (payloadError) {
      await decrementUsage(userId)
      return NextResponse.json({ error: payloadError }, { status: 413 })
    }

    const {
      prompt,
      postType,
      tone,
      course,
      classmatePost,
      professorCriteria,
      videoSummary,
      minWords,
      maxWords,
      styleFingerprint,
      sessionId,
      instructorPdfBase64,
      courseNotes,
      refineFeedback,
      previousDraft,
    } = body

    if (!prompt?.trim()) {
      await decrementUsage(userId)
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const spendCheck = await checkSpendGuard()
    if (!spendCheck.allowed) {
      await decrementUsage(userId)
      return NextResponse.json(
        { error: spendCheck.reason ?? 'Service temporarily unavailable. Please try again later.' },
        { status: 503 },
      )
    }

    const resolvedPostType = resolvePostType(postType)
    const wordTarget = resolveWordTarget(resolvedPostType, minWords, maxWords)
    const resolvedStyle = resolveStyleFingerprint(styleFingerprint)

    const result = await runDiscussionWritingEngine({
      client,
      userId,
      prompt,
      postType: resolvedPostType,
      tone: tone || 'thoughtful',
      course: course || undefined,
      classmatePost: classmatePost || undefined,
      professorCriteria: professorCriteria || undefined,
      videoSummary: videoSummary || undefined,
      courseNotes: typeof courseNotes === 'string' && courseNotes.trim() ? courseNotes.trim() : undefined,
      wordMin: wordTarget.min,
      wordMax: wordTarget.max,
      styleFingerprint: resolvedStyle,
      instructorPdfBase64,
      refineFeedback,
      previousDraft,
      startedAt: generationStart,
    })

    await recordGenerationSpend(result.costs.totalCostUsd)

    const wcStatus = wordCountStatus(result.content, wordTarget.min, wordTarget.max)
    const hasPdf =
      typeof instructorPdfBase64 === 'string' &&
      instructorPdfBase64.length > 0 &&
      (resolvedPostType === 'classmate' || resolvedPostType === 'instructor')

    console.log(
      JSON.stringify({
        event: result.isRefinement ? 'refinement_complete' : 'generation_complete',
        prompt_version: result.promptVersion,
        post_type: resolvedPostType,
        is_refinement: result.isRefinement,
        model_draft: result.modelDraft,
        model_humanizer: result.modelHumanizer,
        pass1_tokens: { in: result.costs.pass1.inputTokens, out: result.costs.pass1.outputTokens },
        pass2_tokens: { in: result.costs.pass2.inputTokens, out: result.costs.pass2.outputTokens },
        eval_scores: result.eval.evalBefore.scores,
        eval_total: result.eval.evalBefore.total,
        eval_passed: result.eval.evalBefore.pass,
        eval_corrected: result.eval.corrected,
        eval_after_total: result.eval.evalAfter?.total ?? null,
        total_cost_usd: result.costs.totalCostUsd.toFixed(6),
        violations_found: result.validation.violations.length,
        fix_method: result.validation.fixMethod,
        word_count: countWords(result.content),
        word_target: `${wordTarget.min}-${wordTarget.max}`,
        style_active: !!resolvedStyle,
        had_pdf: hasPdf,
        had_course_notes: typeof courseNotes === 'string' && courseNotes.trim().length > 0,
        timing_ms: result.timings,
        timestamp: new Date().toISOString(),
      }),
    )

    trackServer({
      event_name: 'post_generated',
      user_id: userId,
      session_id: typeof sessionId === 'string' ? sessionId : undefined,
      prompt_version: result.promptVersion,
      event_data: {
        post_type: resolvedPostType,
        tone: tone || 'thoughtful',
        word_count: wcStatus.count,
        word_target_min: wordTarget.min,
        word_target_max: wordTarget.max,
        word_count_in_range: wcStatus.inRange,
        had_video_summary: !!(videoSummary?.trim()),
        had_criteria: !!(professorCriteria?.trim()),
        had_classmate_post: !!(classmatePost?.trim()),
        had_course: !!(course?.trim()),
        violations_found: result.validation.violations.length,
        fix_method: result.validation.fixMethod,
        cost_usd: parseFloat(result.costs.totalCostUsd.toFixed(6)),
        total_ms: result.timings.total,
        prompt_version: result.promptVersion,
      },
    }).catch(() => {})

    return NextResponse.json({
      content: result.content,
      wordCount: wcStatus.count,
      wordTarget: wcStatus.target,
      wordCountInRange: wcStatus.inRange,
      readiness: buildReadinessPacket({
        postType: resolvedPostType,
        wordCount: wcStatus.count,
        wordTarget: wcStatus.target,
        wordCountInRange: wcStatus.inRange,
        hadCourseNotes: typeof courseNotes === 'string' && courseNotes.trim().length > 0,
        hadVideoSummary: !!(videoSummary?.trim()),
        hadCriteria: !!(professorCriteria?.trim()),
        hadClassmatePost: !!(classmatePost?.trim()),
        hadPdf: hasPdf,
        hadStyle: !!resolvedStyle,
      }),
      violationsFound: result.validation.violations.length,
      fixMethod: result.validation.fixMethod,
      promptVersion: result.promptVersion,
      costUsd: parseFloat(result.costs.totalCostUsd.toFixed(6)),
      totalMs: result.timings.total,
      monthCount: usage.count,
      monthLimit: usage.limit,
      evalScore: result.eval.evalBefore.total,
      evalCorrected: result.eval.corrected,
      isRefinement: result.isRefinement,
    })
  } catch (error) {
    await decrementUsage(userId)
    console.error(
      JSON.stringify({
        event: 'generation_error',
        error: error instanceof Error ? error.message : 'unknown',
        timestamp: new Date().toISOString(),
      }),
    )
    return NextResponse.json({ error: 'Failed to generate post' }, { status: 500 })
  }
}

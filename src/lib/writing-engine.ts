import Anthropic from '@anthropic-ai/sdk'
import {
  CLASSMATE_REPLY_SYSTEM_PROMPT,
  DRAFT_SYSTEM_PROMPT,
  HUMANIZER_SYSTEM_PROMPT,
  INSTRUCTOR_REPLY_SYSTEM_PROMPT,
  PROMPT_VERSION,
  buildDraftPrompt,
  buildHumanizerPrompt,
} from '@/lib/humanization/prompts'
import { validateAndFix } from '@/lib/humanization/validator'
import {
  CORRECT_MODEL,
  EVAL_MODEL,
  buildRefinementPrompt,
  selfEvalAndCorrect,
} from '@/lib/humanization/self-eval'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { calculatePassCost, sumCosts } from '@/lib/costs'
import type { StyleFingerprint } from '@/lib/style/types'

const MODEL_DRAFT = 'claude-sonnet-4-6'
const MODEL_HUMANIZER = 'claude-sonnet-4-6'
const HISTORY_LIMIT = 5
const SIMILARITY_THRESHOLD = 0.72
const MAX_PROMPT_EXCERPT = 240
const MAX_OUTPUT_EXCERPT = 220

const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'has', 'had', 'were', 'was',
  'are', 'but', 'not', 'you', 'your', 'their', 'they', 'them', 'then', 'when', 'what', 'which',
  'about', 'into', 'there', 'would', 'could', 'should', 'been', 'being', 'because', 'while',
  'where', 'who', 'whom', 'how', 'why', 'all', 'any', 'can', 'just', 'like', 'more', 'most',
  'some', 'such', 'than', 'too', 'very', 'one', 'two', 'three', 'it', 'its', 'i', 'me', 'my',
  'we', 'our', 'us', 'on', 'in', 'at', 'of', 'to', 'a', 'an', 'is', 'as', 'by', 'or', 'if',
])

const OPENING_PATTERNS = [
  'start from a concrete personal moment before naming the concept',
  'start from a small contradiction or mild disagreement',
  'start from a specific observation, then move into the course idea',
  'start with a real question and answer it partway through',
]

const STRUCTURE_PATTERNS = [
  'two compact paragraphs with one sharp turn between them',
  'one longer paragraph followed by a short unresolved closing question',
  'three uneven paragraphs where the middle paragraph carries the example',
  'one concise paragraph with a late personal detail, not a polished essay shape',
]

const EXAMPLE_PATTERNS = [
  'work, scheduling, money, or family logistics',
  'a class, campus, commute, or online-course moment',
  'a purchase, app, media habit, or everyday decision',
  'a disagreement, uncertainty, or changed mind',
]

export type WritingPostType = 'initial' | 'classmate' | 'instructor'

export const DEFAULT_WORD_COUNT_TARGETS: Record<WritingPostType, { min: number; max: number }> = {
  initial: { min: 250, max: 400 },
  classmate: { min: 50, max: 200 },
  instructor: { min: 100, max: 150 },
}

type PdfContentBlock = {
  type: 'document'
  source: { type: 'base64'; media_type: 'application/pdf'; data: string }
}

type TextContentBlock = { type: 'text'; text: string }

type EngineContent = string | Array<PdfContentBlock | TextContentBlock>
type AnthropicTextResponse = {
  content?: Array<{ type: string; text?: string }>
}

interface RecentGenerationRecord {
  post_type: WritingPostType
  prompt_excerpt: string | null
  output: string | null
  word_count: number | null
  prompt_version: string | null
  created_at: string
}

export interface RunDiscussionEngineInput {
  client: Anthropic
  userId: string
  prompt: string
  postType: WritingPostType
  tone: string
  course?: string
  classmatePost?: string
  professorCriteria?: string
  videoSummary?: string
  courseNotes?: string
  wordMin: number
  wordMax: number
  styleFingerprint?: StyleFingerprint | null
  instructorPdfBase64?: string
  refineFeedback?: string
  previousDraft?: string
  startedAt?: number
}

export interface RunPrimaryWithSafetyInput {
  client: Anthropic
  system: string
  content: EngineContent
  targetLabel: string
  maxTokens: number
  temperature?: number
  startedAt?: number
}

export interface WritingEngineResult {
  content: string
  promptVersion: string
  modelDraft: string
  modelHumanizer: string
  costs: {
    totalCostUsd: number
    pass1: ReturnType<typeof calculatePassCost>
    pass2: ReturnType<typeof calculatePassCost>
    eval: ReturnType<typeof calculatePassCost>
    fix: ReturnType<typeof calculatePassCost>
  }
  timings: {
    pass1: number
    pass2: number
    pass3: number
    pass4: number
    total: number
  }
  validation: {
    violations: string[]
    fixMethod: 'none' | 'surgical' | 'full_rerun'
  }
  eval: Awaited<ReturnType<typeof selfEvalAndCorrect>>
  isRefinement: boolean
}

export interface PrimaryWithSafetyResult {
  content: string
  promptVersion: string
  modelDraft: string
  modelHumanizer: string
  costs: {
    totalCostUsd: number
    pass1: ReturnType<typeof calculatePassCost>
    pass2: ReturnType<typeof calculatePassCost>
  }
  timings: {
    pass1: number
    pass2: number
    pass3: number
    total: number
  }
  validation: {
    violations: string[]
    fixMethod: 'none' | 'surgical' | 'full_rerun'
  }
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function wordCountStatus(text: string, min: number, max: number) {
  const count = countWords(text)
  return { inRange: count >= min && count <= max, count, target: `${min}-${max} words` }
}

function textFromResponse(response: AnthropicTextResponse, fallback = ''): string {
  const firstBlock = response.content?.[0]
  return firstBlock?.type === 'text' && typeof firstBlock.text === 'string'
    ? firstBlock.text.trim()
    : fallback
}

function systemPromptFor(postType: WritingPostType): string {
  if (postType === 'classmate') return CLASSMATE_REPLY_SYSTEM_PROMPT
  if (postType === 'instructor') return INSTRUCTOR_REPLY_SYSTEM_PROMPT
  return DRAFT_SYSTEM_PROMPT
}

function pickFrom<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length]
}

function buildVariationDirective(postType: WritingPostType): string {
  const seed = Date.now() + Math.floor(Math.random() * 100000)
  const opening = pickFrom(OPENING_PATTERNS, seed)
  const structure = pickFrom(STRUCTURE_PATTERNS, seed >> 2)
  const example = pickFrom(EXAMPLE_PATTERNS, seed >> 4)

  if (postType === 'classmate') {
    return [
      `Variation seed: ${seed}.`,
      `Anchor to the classmate's most specific claim, not the broad topic.`,
      `Use this structure bias: ${structure}.`,
      `Use this example lane only if it naturally fits: ${example}.`,
      'Avoid generic praise and avoid repeating the original post in different words.',
    ].join('\n')
  }

  if (postType === 'instructor') {
    return [
      `Variation seed: ${seed}.`,
      `Open by directly engaging the instructor's specific point.`,
      `Use this structure bias: ${structure}.`,
      `Use this example lane only if it naturally fits: ${example}.`,
      'Do not make the reply sound like a template or formal thank-you note.',
    ].join('\n')
  }

  return [
    `Variation seed: ${seed}.`,
    `Use this opening bias: ${opening}.`,
    `Use this structure bias: ${structure}.`,
    `Use this example lane only if it naturally fits: ${example}.`,
    'Make the take specific to this prompt and this student context, not a reusable answer.',
  ].join('\n')
}

export function resolvePostType(postType: unknown): WritingPostType {
  if (postType === 'classmate') return 'classmate'
  if (postType === 'instructor') return 'instructor'
  return 'initial'
}

export function resolveWordTarget(
  postType: WritingPostType,
  minWords: unknown,
  maxWords: unknown,
): { min: number; max: number } {
  const defaults = DEFAULT_WORD_COUNT_TARGETS[postType]
  const min = typeof minWords === 'number' && minWords >= 25 ? minWords : defaults.min
  const max = typeof maxWords === 'number' && maxWords >= min ? maxWords : defaults.max
  return { min, max }
}

export function resolveStyleFingerprint(styleFingerprint: unknown): StyleFingerprint | null {
  return styleFingerprint &&
    typeof styleFingerprint === 'object' &&
    typeof (styleFingerprint as { sentence_rhythm?: unknown }).sentence_rhythm === 'string'
    ? (styleFingerprint as StyleFingerprint)
    : null
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(normalizeWords(a))
  const setB = new Set(normalizeWords(b))
  if (setA.size === 0 || setB.size === 0) return 0

  let intersection = 0
  for (const token of setA) {
    if (setB.has(token)) intersection++
  }
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 0 : intersection / union
}

function firstSentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  const match = trimmed.match(/^([^.!?]{20,140}[.!?]?)/)
  return (match?.[1] ?? trimmed.slice(0, 140)).trim()
}

function excerpt(text: string, limit: number): string {
  const clean = text.trim().replace(/\s+/g, ' ')
  return clean.length <= limit ? clean : `${clean.slice(0, limit).trim()}…`
}

async function fetchRecentGenerations(userId: string, postType: WritingPostType): Promise<RecentGenerationRecord[]> {
  const admin = getSupabaseAdmin()
  if (!admin) return []

  const { data, error } = await admin
    .from('generations')
    .select('post_type,prompt_excerpt,output,word_count,prompt_version,created_at')
    .eq('user_id', userId)
    .eq('post_type', postType)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)

  if (error || !Array.isArray(data)) return []
  return data as RecentGenerationRecord[]
}

function buildFreshnessDirective(
  postType: WritingPostType,
  prompt: string,
  recentGenerations: RecentGenerationRecord[],
): string {
  const lines: string[] = [
    `This is for a ${postType} response to a new prompt.`,
    'Your job is to sound like the same student, but not like a copy of any recent answer.',
    'Use a different opening move, different example lane, and different paragraph shape than recent versions.',
    'Do not reuse the same first sentence structure, same lead-in phrase, or same closing motion.',
  ]

  if (recentGenerations.length > 0) {
    lines.push('Recent outputs to avoid echoing:')
    recentGenerations.slice(0, 3).forEach((item, index) => {
      const promptPiece = item.prompt_excerpt ? excerpt(item.prompt_excerpt, 90) : 'no prompt excerpt'
      const outputPiece = item.output ? excerpt(firstSentence(item.output), MAX_OUTPUT_EXCERPT) : 'no output'
      lines.push(`${index + 1}. Prompt: ${promptPiece}`)
      lines.push(`   Opening: ${outputPiece}`)
    })
  }

  lines.push(
    `Freshness rule for this prompt: the new response must feel newly composed for "${excerpt(prompt, MAX_PROMPT_EXCERPT)}".`,
    'If the prompt is close to something seen before, change the angle, the personal example, and the order of ideas.',
  )

  return lines.join('\n')
}

function maxSimilarityToHistory(content: string, history: RecentGenerationRecord[]): number {
  let max = 0
  for (const item of history) {
    if (!item.output) continue
    const similarity = jaccardSimilarity(content, item.output)
    if (similarity > max) max = similarity
  }
  return max
}

async function storeGeneration(params: {
  userId: string
  postType: WritingPostType
  prompt: string
  output: string
  wordCount: number
  costUsd: number
  promptVersion: string
}): Promise<void> {
  const admin = getSupabaseAdmin()
  if (!admin) return

  try {
    await admin.from('generations').insert({
      user_id: params.userId,
      post_type: params.postType,
      prompt_excerpt: excerpt(params.prompt, 280),
      word_count: params.wordCount,
      cost_usd: params.costUsd,
      prompt_version: params.promptVersion,
      output: params.output,
    })
  } catch {
    /* best effort */
  }
}

export async function runDiscussionWritingEngine(input: RunDiscussionEngineInput): Promise<WritingEngineResult> {
  const startedAt = input.startedAt ?? Date.now()
  const wordTargetLabel = `${input.wordMin}-${input.wordMax} words`
  const recentGenerations = await fetchRecentGenerations(input.userId, input.postType)
  const hasPdf =
    typeof input.instructorPdfBase64 === 'string' &&
    input.instructorPdfBase64.length > 0 &&
    (input.postType === 'classmate' || input.postType === 'instructor')

  const isRefinement =
    typeof input.refineFeedback === 'string' &&
    input.refineFeedback.trim().length > 0 &&
    typeof input.previousDraft === 'string' &&
    input.previousDraft.trim().length > 0

  let pass1Cost = calculatePassCost(MODEL_DRAFT, 0, 0)
  let pass2Cost = calculatePassCost(MODEL_HUMANIZER, 0, 0)
  let pass1Ms = 0
  let pass2Ms = 0
  let preValidationText: string

  if (isRefinement) {
    const refineMsg = buildRefinementPrompt(
      input.previousDraft as string,
      (input.refineFeedback as string).trim(),
      wordTargetLabel,
    )
    const refineStart = Date.now()
    const refineResponse = await input.client.messages.create({
      model: MODEL_HUMANIZER,
      max_tokens: 900,
      temperature: 0.4,
      system: HUMANIZER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: refineMsg }],
    })
    pass1Ms = Date.now() - refineStart
    pass1Cost = calculatePassCost(
      MODEL_HUMANIZER,
      refineResponse.usage.input_tokens,
      refineResponse.usage.output_tokens,
    )
    preValidationText = textFromResponse(refineResponse, input.previousDraft as string)
  } else {
    const draftUserMessage = buildDraftPrompt({
      professorPrompt: input.prompt,
      postType: input.postType,
      tone: input.tone,
      course: input.course,
      classmatePost: input.classmatePost,
      instructorPost: input.postType === 'instructor' ? input.classmatePost : undefined,
      professorCriteria: input.professorCriteria,
      videoSummary: input.videoSummary,
      courseNotes: input.courseNotes,
      wordMin: input.wordMin,
      wordMax: input.wordMax,
      styleFingerprint: input.styleFingerprint,
      variationDirective: `${buildVariationDirective(input.postType)}\n\n${buildFreshnessDirective(input.postType, input.prompt, recentGenerations)}`,
    })

    const pass1Content: EngineContent = hasPdf
      ? [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: input.instructorPdfBase64 as string,
            },
          },
          { type: 'text', text: draftUserMessage },
        ]
      : draftUserMessage

    const pass1Start = Date.now()
    const draftResponse = await input.client.messages.create({
      model: MODEL_DRAFT,
      max_tokens: 900,
      temperature: 1,
      system: systemPromptFor(input.postType),
      messages: [{ role: 'user', content: pass1Content }],
    })
    pass1Ms = Date.now() - pass1Start
    pass1Cost = calculatePassCost(
      MODEL_DRAFT,
      draftResponse.usage.input_tokens,
      draftResponse.usage.output_tokens,
    )

    const draft = textFromResponse(draftResponse)
    if (!draft) throw new Error('Generation failed on draft pass')

    const pass2Start = Date.now()
    const humanizedResponse = await input.client.messages.create({
      model: MODEL_HUMANIZER,
      max_tokens: 900,
      temperature: 0.4,
      system: HUMANIZER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildHumanizerPrompt(draft, input.postType, wordTargetLabel) }],
    })
    pass2Ms = Date.now() - pass2Start
    pass2Cost = calculatePassCost(
      MODEL_HUMANIZER,
      humanizedResponse.usage.input_tokens,
      humanizedResponse.usage.output_tokens,
    )
    preValidationText = textFromResponse(humanizedResponse, draft)
  }

  const pass3Start = Date.now()
  const validationResult = await validateAndFix(input.client, preValidationText, async (text) => {
    const rerun = await input.client.messages.create({
      model: MODEL_HUMANIZER,
      max_tokens: 900,
      temperature: 0.4,
      system: HUMANIZER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildHumanizerPrompt(text, input.postType, wordTargetLabel) }],
    })
    return textFromResponse(rerun, text)
  })
  const pass3Ms = Date.now() - pass3Start

  const pass4Start = Date.now()
  const evalResult = await selfEvalAndCorrect(
    input.client,
    validationResult.text,
    input.postType,
    input.prompt,
    wordTargetLabel,
  )
  const pass4Ms = Date.now() - pass4Start

  const evalCost = calculatePassCost(
    EVAL_MODEL,
    evalResult.evalTokens.input,
    evalResult.evalTokens.output,
  )
  const fixCost = evalResult.fixTokens
    ? calculatePassCost(CORRECT_MODEL, evalResult.fixTokens.input, evalResult.fixTokens.output)
    : calculatePassCost(CORRECT_MODEL, 0, 0)
  const costs = sumCosts([pass1Cost, pass2Cost, evalCost, fixCost])
  const similarity = maxSimilarityToHistory(evalResult.text, recentGenerations)
  let finalText = evalResult.text
  let rerolledForFreshness = false

  if (similarity >= SIMILARITY_THRESHOLD && recentGenerations.length > 0) {
    rerolledForFreshness = true
    const rerollDirective = [
      buildVariationDirective(input.postType),
      buildFreshnessDirective(input.postType, input.prompt, recentGenerations),
      'Freshness repair: the previous version was too similar to a recent output. Rewrite with a different opening, different concrete example, and a different paragraph rhythm.',
    ].join('\n\n')

    const rerollInput = {
      ...input,
      previousDraft: evalResult.text,
      refineFeedback: rerollDirective,
      startedAt: Date.now(),
    }

    const rerollResult = await runDiscussionWritingEngineOnce(rerollInput, rerollDirective)
    finalText = rerollResult.content
  }

  await storeGeneration({
    userId: input.userId,
    postType: input.postType,
    prompt: input.prompt,
    output: finalText,
    wordCount: countWords(finalText),
    costUsd: costs.totalCostUsd,
    promptVersion: PROMPT_VERSION,
  })

  return {
    content: finalText,
    promptVersion: PROMPT_VERSION,
    modelDraft: MODEL_DRAFT,
    modelHumanizer: MODEL_HUMANIZER,
    costs: {
      totalCostUsd: costs.totalCostUsd,
      pass1: pass1Cost,
      pass2: pass2Cost,
      eval: evalCost,
      fix: fixCost,
    },
    timings: {
      pass1: pass1Ms,
      pass2: pass2Ms,
      pass3: pass3Ms,
      pass4: pass4Ms,
      total: Date.now() - startedAt,
    },
    validation: {
      violations: validationResult.violations,
      fixMethod: validationResult.fixMethod,
    },
    eval: evalResult,
    isRefinement,
  }
}

async function runDiscussionWritingEngineOnce(
  input: RunDiscussionEngineInput,
  freshnessDirective: string,
): Promise<{ content: string }> {
  const wordTargetLabel = `${input.wordMin}-${input.wordMax} words`
  const hasPdf =
    typeof input.instructorPdfBase64 === 'string' &&
    input.instructorPdfBase64.length > 0 &&
    (input.postType === 'classmate' || input.postType === 'instructor')

  let preValidationText: string

  if (
    typeof input.refineFeedback === 'string' &&
    input.refineFeedback.trim().length > 0 &&
    typeof input.previousDraft === 'string' &&
    input.previousDraft.trim().length > 0
  ) {
    const refineMsg = buildRefinementPrompt(
      input.previousDraft,
      input.refineFeedback.trim(),
      wordTargetLabel,
    )
    const refineResponse = await input.client.messages.create({
      model: MODEL_HUMANIZER,
      max_tokens: 900,
      temperature: 0.4,
      system: HUMANIZER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: refineMsg }],
    })
    preValidationText = textFromResponse(refineResponse, input.previousDraft)
  } else {
    const draftUserMessage = buildDraftPrompt({
      professorPrompt: input.prompt,
      postType: input.postType,
      tone: input.tone,
      course: input.course,
      classmatePost: input.classmatePost,
      instructorPost: input.postType === 'instructor' ? input.classmatePost : undefined,
      professorCriteria: input.professorCriteria,
      videoSummary: input.videoSummary,
      courseNotes: input.courseNotes,
      wordMin: input.wordMin,
      wordMax: input.wordMax,
      styleFingerprint: input.styleFingerprint,
      variationDirective: freshnessDirective,
    })

    const pass1Content: EngineContent = hasPdf
      ? [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: input.instructorPdfBase64 as string,
            },
          },
          { type: 'text', text: draftUserMessage },
        ]
      : draftUserMessage

    const draftResponse = await input.client.messages.create({
      model: MODEL_DRAFT,
      max_tokens: 900,
      temperature: 1,
      system: systemPromptFor(input.postType),
      messages: [{ role: 'user', content: pass1Content }],
    })

    const draft = textFromResponse(draftResponse)
    const humanizedResponse = await input.client.messages.create({
      model: MODEL_HUMANIZER,
      max_tokens: 900,
      temperature: 0.4,
      system: HUMANIZER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildHumanizerPrompt(draft, input.postType, wordTargetLabel) }],
    })
    preValidationText = textFromResponse(humanizedResponse, draft)
  }

  const validationResult = await validateAndFix(input.client, preValidationText, async (text) => {
    const rerun = await input.client.messages.create({
      model: MODEL_HUMANIZER,
      max_tokens: 900,
      temperature: 0.4,
      system: HUMANIZER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildHumanizerPrompt(text, input.postType, wordTargetLabel) }],
    })
    return textFromResponse(rerun, text)
  })

  const evalResult = await selfEvalAndCorrect(
    input.client,
    validationResult.text,
    input.postType,
    input.prompt,
    wordTargetLabel,
  )

  return { content: evalResult.text }
}

export async function runPrimaryWithSafetyEngine(input: RunPrimaryWithSafetyInput): Promise<PrimaryWithSafetyResult> {
  const startedAt = input.startedAt ?? Date.now()
  const pass1Start = Date.now()
  const draftResponse = await input.client.messages.create({
    model: MODEL_DRAFT,
    max_tokens: input.maxTokens,
    temperature: input.temperature ?? 0.7,
    system: input.system,
    messages: [{ role: 'user', content: input.content }],
  })
  const pass1Ms = Date.now() - pass1Start
  const pass1Cost = calculatePassCost(
    MODEL_DRAFT,
    draftResponse.usage.input_tokens,
    draftResponse.usage.output_tokens,
  )

  const primaryText = textFromResponse(draftResponse)
  if (!primaryText) throw new Error('Primary writing pass returned empty content')

  const pass2Start = Date.now()
  const humanizedResponse = await input.client.messages.create({
    model: MODEL_HUMANIZER,
    max_tokens: input.maxTokens,
    temperature: 0.4,
    system: HUMANIZER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildHumanizerPrompt(primaryText, input.targetLabel, 'as long as needed') }],
  })
  const pass2Ms = Date.now() - pass2Start
  const pass2Cost = calculatePassCost(
    MODEL_HUMANIZER,
    humanizedResponse.usage.input_tokens,
    humanizedResponse.usage.output_tokens,
  )
  const safetyText = textFromResponse(humanizedResponse, primaryText)

  const pass3Start = Date.now()
  const validationResult = await validateAndFix(input.client, safetyText, async (text) => {
    const rerun = await input.client.messages.create({
      model: MODEL_HUMANIZER,
      max_tokens: input.maxTokens,
      temperature: 0.4,
      system: HUMANIZER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildHumanizerPrompt(text, input.targetLabel, 'as long as needed') }],
    })
    return textFromResponse(rerun, text)
  })
  const pass3Ms = Date.now() - pass3Start
  const costs = sumCosts([pass1Cost, pass2Cost])

  return {
    content: validationResult.text,
    promptVersion: PROMPT_VERSION,
    modelDraft: MODEL_DRAFT,
    modelHumanizer: MODEL_HUMANIZER,
    costs: {
      totalCostUsd: costs.totalCostUsd,
      pass1: pass1Cost,
      pass2: pass2Cost,
    },
    timings: {
      pass1: pass1Ms,
      pass2: pass2Ms,
      pass3: pass3Ms,
      total: Date.now() - startedAt,
    },
    validation: {
      violations: validationResult.violations,
      fixMethod: validationResult.fixMethod,
    },
  }
}

/**
 * Pass 4 — Self-Evaluation
 *
 * Uses claude-haiku-4-5 to score the final output on 5 objective criteria
 * before returning it to the student. If the score is below threshold, a
 * targeted correction pass (Sonnet) fixes only the failing criteria.
 *
 * Goal: the first output the student sees is the best the IP can produce.
 * This eliminates "generate → not good enough → regenerate" loops on the
 * student's end by running that loop internally before delivery.
 *
 * Scoring criteria (each 0-2, total /10):
 *   1. Relevance   — directly addresses the specific prompt, not just the topic
 *   2. Specificity — a concrete personal detail (name / place / job / event)
 *   3. Voice       — burstiness, contractions, no AI vocabulary
 *   4. Ending      — trails off or asks a question, does NOT summarize neatly
 *   5. Position    — takes a clear stance, not "both sides have merit"
 *
 * Pass threshold: 7/10
 * Max correction attempts: 1 (bounds latency)
 */

import Anthropic from '@anthropic-ai/sdk'

export const EVAL_MODEL     = 'claude-haiku-4-5'
export const CORRECT_MODEL  = 'claude-sonnet-4-6'
export const PASS_THRESHOLD = 7

export interface SelfEvalResult {
  scores: number[]    // [relevance, specificity, voice, ending, position]
  total:  number      // 0-10
  pass:   boolean
  issues: string[]    // concrete action items, only populated when a score < 2
}

export interface CorrectionResult {
  text:       string
  evalBefore: SelfEvalResult
  evalAfter:  SelfEvalResult | null   // null if correction was skipped
  corrected:  boolean
  evalTokens: { input: number; output: number }
  fixTokens:  { input: number; output: number } | null
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

function buildEvalPrompt(
  post: string,
  postType: 'initial' | 'classmate' | 'instructor',
  originalPrompt: string,
): string {
  return `Score this college discussion ${postType} post. Return ONLY valid JSON — no markdown, no preamble.

ORIGINAL PROMPT: "${originalPrompt.slice(0, 400)}"

POST:
---
${post}
---

Score each criterion 0, 1, or 2:
1. RELEVANCE: Addresses the specific prompt (not just the general topic)? 0=off-topic, 1=partial, 2=fully
2. SPECIFICITY: Has a concrete personal detail (specific job/person/place/event/outcome, NOT "I've noticed that")? 0=none, 1=vague, 2=specific
3. VOICE: Genuinely varied sentence lengths + natural contractions + zero AI vocabulary? 0=AI-sounding, 1=borderline, 2=clearly human
4. ENDING: Ends naturally (question, trailing thought) NOT with a neat wrap-up or summary? 0=AI ending, 1=borderline, 2=natural
5. POSITION: Takes a real stance, NOT "both sides have merit"? 0=both-sides/neutral, 1=mild lean, 2=clear take

Return exactly this shape:
{"scores":[s1,s2,s3,s4,s5],"total":N,"pass":bool,"issues":["only include an entry when score<2, make it a specific action like 'add a name or place to the personal example' not 'improve specificity'"]}

pass = true when total >= ${PASS_THRESHOLD}`
}

function buildCorrectionPrompt(
  post: string,
  issues: string[],
  wordTarget: string,
): string {
  return `Revise this discussion post to fix the listed issues only. Change nothing that is already working.

ISSUES TO FIX (all of them):
${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

CURRENT POST:
---
${post}
---

Rules:
- Address every listed issue
- Preserve voice, sentence variety, argument, and structure where they aren't broken
- Do NOT introduce any AI vocabulary (furthermore, moreover, pivotal, robust, etc.)
- Do NOT add a neat conclusion if the ending was already natural
- Stay within ${wordTarget}

Output ONLY the revised post. No labels, no commentary.`
}

export function buildRefinementPrompt(
  previousDraft: string,
  studentFeedback: string,
  wordTarget: string,
): string {
  return `Revise this college discussion post based on the student's specific feedback.
Preserve everything the student didn't mention. Change only what the feedback addresses.

STUDENT'S FEEDBACK:
"${studentFeedback}"

CURRENT DRAFT:
---
${previousDraft}
---

Rules:
- Address the feedback precisely — don't rewrite things that weren't mentioned
- Maintain the human voice, burstiness, and anti-AI characteristics of the original
- Stay within ${wordTarget}
- Do not add AI vocabulary while revising
- If the feedback asks for more content, add it naturally without rewriting the whole post

Output ONLY the revised post. No preamble, no explanation.`
}

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Score a post on the 5 criteria. Fails open (returns pass: true) if the
 * eval call itself errors so we never block delivery due to eval infra failures.
 */
export async function evalPost(
  client: Anthropic,
  post: string,
  postType: 'initial' | 'classmate' | 'instructor',
  originalPrompt: string,
): Promise<{ result: SelfEvalResult; inputTokens: number; outputTokens: number }> {
  try {
    const response = await client.messages.create({
      model: EVAL_MODEL,
      max_tokens: 250,
      temperature: 0,   // deterministic scoring
      messages: [{ role: 'user', content: buildEvalPrompt(post, postType, originalPrompt) }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const parsed = JSON.parse(raw.replace(/^```json\n?/, '').replace(/\n?```$/, '')) as SelfEvalResult

    return {
      result: {
        scores:  Array.isArray(parsed.scores) ? parsed.scores : [2, 2, 2, 2, 2],
        total:   typeof parsed.total === 'number' ? parsed.total : 10,
        pass:    typeof parsed.pass  === 'boolean' ? parsed.pass : true,
        issues:  Array.isArray(parsed.issues) ? parsed.issues : [],
      },
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
  } catch {
    // Fail open — eval errors should never block the student
    return {
      result: { scores: [2, 2, 2, 2, 2], total: 10, pass: true, issues: [] },
      inputTokens: 0,
      outputTokens: 0,
    }
  }
}

/**
 * Run the full self-evaluation + optional correction cycle.
 *
 * 1. Evaluate the post
 * 2. If it passes, return as-is
 * 3. If it fails, run one targeted correction pass with Sonnet
 * 4. Re-evaluate the correction (for logging purposes — always deliver the correction)
 */
export async function selfEvalAndCorrect(
  client: Anthropic,
  post: string,
  postType: 'initial' | 'classmate' | 'instructor',
  originalPrompt: string,
  wordTarget: string,
): Promise<CorrectionResult> {
  // Eval the current output
  const { result: evalBefore, inputTokens: evalIn, outputTokens: evalOut } = await evalPost(
    client, post, postType, originalPrompt,
  )

  if (evalBefore.pass) {
    return {
      text: post,
      evalBefore,
      evalAfter: null,
      corrected: false,
      evalTokens: { input: evalIn, output: evalOut },
      fixTokens: null,
    }
  }

  // Post didn't pass — run targeted correction
  let correctedText = post
  let fixIn = 0
  let fixOut = 0

  try {
    const correctionResponse = await client.messages.create({
      model:       CORRECT_MODEL,
      max_tokens:  900,
      temperature: 0.3,  // slightly deterministic for surgical edits
      messages: [{
        role:    'user',
        content: buildCorrectionPrompt(post, evalBefore.issues, wordTarget),
      }],
    })

    correctedText = correctionResponse.content[0].type === 'text'
      ? correctionResponse.content[0].text.trim()
      : post

    fixIn  = correctionResponse.usage.input_tokens
    fixOut = correctionResponse.usage.output_tokens
  } catch {
    // Correction failed — deliver original rather than blocking
    correctedText = post
  }

  // Quick re-eval of the corrected version (for logging, not gating)
  const { result: evalAfter } = await evalPost(
    client, correctedText, postType, originalPrompt,
  )

  return {
    text: correctedText,
    evalBefore,
    evalAfter,
    corrected: correctedText !== post,
    evalTokens: { input: evalIn, output: evalOut },
    fixTokens: correctedText !== post ? { input: fixIn, output: fixOut } : null,
  }
}

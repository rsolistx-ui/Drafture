/**
 * POST /api/admin/prompt-improve
 *
 * Self-improvement engine for the humanization IP.
 *
 * How it works:
 *  1. Pulls quality metrics from analytics_events (copy rate + thumbs-up rate per prompt version)
 *  2. Sends current prompt + performance stats to Claude (Opus 4.7, adaptive thinking)
 *  3. Claude returns specific, actionable prompt improvement suggestions
 *  4. Admin reviews and applies them manually — never auto-deployed
 *
 * Protected by ADMIN_SECRET. Never called automatically — admin-triggered only.
 * This is the "supervised self-improvement" model: Claude identifies what to fix,
 * a human decides what to ship. Keeps the IP sharp without autonomous code changes.
 *
 * Roadmap:
 *  - Phase 2: store suggestions in DB, track which ones were applied, measure delta
 *  - Phase 3: A/B variant framework — auto-split traffic, compare copy rates
 *  - Phase 4: weekly cron-triggered analysis, Slack webhook for suggestions
 */

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  DRAFT_SYSTEM_PROMPT,
  CLASSMATE_REPLY_SYSTEM_PROMPT,
  INSTRUCTOR_REPLY_SYSTEM_PROMPT,
  HUMANIZER_SYSTEM_PROMPT,
  PROMPT_VERSION,
} from '@/lib/humanization/prompts'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// ── Types ─────────────────────────────────────────────────────────────────────

interface PromptMetrics {
  prompt_version: string
  total_generated: number
  total_copied: number
  total_thumbs_up: number
  copy_rate: number
  thumbs_rate: number
}

interface ImprovementSuggestion {
  area: string
  current_behavior: string
  suggested_change: string
  rationale: string
  priority: 'high' | 'medium' | 'low'
}

interface AnalysisResult {
  prompt_version: string
  metrics: PromptMetrics[]
  suggestions: ImprovementSuggestion[]
  overall_assessment: string
  next_version_recommendation: string
  analysis_timestamp: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchMetrics(): Promise<PromptMetrics[]> {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    // Return synthetic data for demonstration when DB isn't configured
    return [
      {
        prompt_version: PROMPT_VERSION,
        total_generated: 0,
        total_copied: 0,
        total_thumbs_up: 0,
        copy_rate: 0,
        thumbs_rate: 0,
      },
    ]
  }

  // Pull generation counts per prompt version (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: generatedRows } = await supabase
    .from('analytics_events')
    .select('event_data')
    .eq('event_name', 'post_generated')
    .gte('occurred_at', thirtyDaysAgo)

  const { data: copiedRows } = await supabase
    .from('analytics_events')
    .select('event_data')
    .eq('event_name', 'post_copied')
    .gte('occurred_at', thirtyDaysAgo)

  const { data: thumbRows } = await supabase
    .from('analytics_events')
    .select('event_data')
    .eq('event_name', 'post_quality_rated')
    .eq('event_data->>rating', 'good')
    .gte('occurred_at', thirtyDaysAgo)

  // Aggregate by prompt version
  const byVersion: Record<string, Omit<PromptMetrics, 'copy_rate' | 'thumbs_rate'>> = {}

  for (const row of generatedRows ?? []) {
    const v = (row.event_data as Record<string, unknown>)?.prompt_version as string ?? 'unknown'
    if (!byVersion[v]) byVersion[v] = { prompt_version: v, total_generated: 0, total_copied: 0, total_thumbs_up: 0 }
    byVersion[v].total_generated++
  }
  for (const row of copiedRows ?? []) {
    // post_copied doesn't store prompt_version — approximate by using current version
    const v = PROMPT_VERSION
    if (!byVersion[v]) byVersion[v] = { prompt_version: v, total_generated: 0, total_copied: 0, total_thumbs_up: 0 }
    byVersion[v].total_copied++
  }
  for (const row of thumbRows ?? []) {
    const v = (row.event_data as Record<string, unknown>)?.prompt_version as string ?? PROMPT_VERSION
    if (!byVersion[v]) byVersion[v] = { prompt_version: v, total_generated: 0, total_copied: 0, total_thumbs_up: 0 }
    byVersion[v].total_thumbs_up++
  }

  return Object.values(byVersion).map((v) => ({
    ...v,
    copy_rate: v.total_generated > 0 ? v.total_copied / v.total_generated : 0,
    thumbs_rate: v.total_generated > 0 ? v.total_thumbs_up / v.total_generated : 0,
  }))
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Admin auth
  const secret = req.headers.get('x-admin-secret')
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { focusArea } = await req.json().catch(() => ({})) as { focusArea?: string }

  try {
    const metrics = await fetchMetrics()

    const metricsText = metrics.map(m =>
      `Version ${m.prompt_version}: ${m.total_generated} generated, ` +
      `${m.total_copied} copied (${(m.copy_rate * 100).toFixed(1)}% copy rate), ` +
      `${m.total_thumbs_up} thumbs-up (${(m.thumbs_rate * 100).toFixed(1)}% approval rate)`
    ).join('\n')

    const analysisPrompt = `You are a prompt engineering expert analyzing a proprietary AI humanization system for college discussion posts. Your job is to identify specific improvements to keep the outputs genuinely human-sounding and AI-detection-resistant.

## Current Performance Metrics (last 30 days)
${metricsText || 'No data yet — system recently launched.'}

## Current Prompt Version
${PROMPT_VERSION}

${focusArea ? `## Focus Area Requested\n${focusArea}\n` : ''}

## Current Prompts Being Analyzed

### INITIAL POST SYSTEM PROMPT:
---
${DRAFT_SYSTEM_PROMPT}
---

### CLASSMATE REPLY SYSTEM PROMPT:
---
${CLASSMATE_REPLY_SYSTEM_PROMPT}
---

### INSTRUCTOR REPLY SYSTEM PROMPT:
---
${INSTRUCTOR_REPLY_SYSTEM_PROMPT}
---

### ADVERSARIAL HUMANIZER SYSTEM PROMPT:
---
${HUMANIZER_SYSTEM_PROMPT}
---

## Your Task

Analyze these prompts as if you are simultaneously:
1. A state-of-the-art AI detection tool (GPTZero, Turnitin, Copyleaks) looking for patterns these prompts might consistently produce
2. A prompt engineer who knows exactly how to fix those patterns

Provide your analysis in the following JSON structure:

{
  "overall_assessment": "2-3 sentence summary of the current system's strengths and main vulnerability areas",
  "suggestions": [
    {
      "area": "which prompt / which check / which rule",
      "current_behavior": "what the prompt currently produces that creates a detectable pattern",
      "suggested_change": "the exact wording change or new rule to add",
      "rationale": "why this change reduces AI detection risk",
      "priority": "high|medium|low"
    }
  ],
  "next_version_recommendation": "what the next version should be (e.g. v1.4.1) and the 1-sentence summary of what changed"
}

Focus on:
- Patterns that AI detectors have learned to catch in the last 6 months
- Any structural consistency in the outputs that could be a statistical fingerprint
- Missing humanization dimensions not yet covered by the 13-check humanizer
- Copy rate signals (if copy rate is low, the posts may be getting flagged at submission)

Return ONLY valid JSON. No markdown, no preamble.`

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 3000,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: analysisPrompt }],
    })

    // Extract text from response (thinking blocks are included but we want the text block)
    const textBlock = response.content.find(b => b.type === 'text')
    const rawText = textBlock?.type === 'text' ? textBlock.text.trim() : ''

    let parsed: { overall_assessment: string; suggestions: ImprovementSuggestion[]; next_version_recommendation: string }
    try {
      // Strip any accidental markdown code fences
      const cleaned = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '')
      parsed = JSON.parse(cleaned)
    } catch {
      // If Claude returned non-JSON (e.g. due to adaptive thinking preamble), try to extract JSON
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return NextResponse.json({ error: 'Analysis returned non-JSON response', raw: rawText }, { status: 500 })
      }
      parsed = JSON.parse(jsonMatch[0])
    }

    const result: AnalysisResult = {
      prompt_version: PROMPT_VERSION,
      metrics,
      suggestions: parsed.suggestions ?? [],
      overall_assessment: parsed.overall_assessment ?? '',
      next_version_recommendation: parsed.next_version_recommendation ?? '',
      analysis_timestamp: new Date().toISOString(),
    }

    console.log(JSON.stringify({
      event: 'prompt_improvement_analysis',
      prompt_version: PROMPT_VERSION,
      suggestion_count: result.suggestions.length,
      high_priority: result.suggestions.filter(s => s.priority === 'high').length,
      timestamp: result.analysis_timestamp,
    }))

    return NextResponse.json(result)

  } catch (error) {
    console.error(JSON.stringify({
      event: 'prompt_improvement_error',
      error: error instanceof Error ? error.message : 'unknown',
      timestamp: new Date().toISOString(),
    }))
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}

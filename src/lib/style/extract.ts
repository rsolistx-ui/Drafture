/**
 * DMD-017 — Style extraction system prompt + build function.
 *
 * Analyzes 1–3 writing samples to produce a StyleFingerprint.
 * Called by /api/style/analyze.
 */

import type { StyleFingerprint } from './types'
import { MAX_SAMPLE_CHARS } from './types'

export const STYLE_EXTRACT_SYSTEM_PROMPT = `You are a forensic writing analyst. You will receive 1–3 discussion board posts written by the same college student. Your job is to extract a precise style fingerprint that will be used to calibrate AI generation to match their natural voice.

You are looking for the SPECIFIC and IDIOSYNCRATIC — things that distinguish this writer from any other student, not general student writing patterns.

WHAT TO ANALYZE:

1. SENTENCE RHYTHM — What's their dominant pattern?
   - short_punchy: avg sentence <12 words, abrupt stops, minimal subordination
   - medium_balanced: 12–20 word average, moderate clause nesting
   - long_flowing: 20+ word averages, lots of embedded clauses and continuation
   - highly_variable: wild swings — 4-word sentences next to 35-word sentences

2. VOICE MARKERS — Specific recurring phrases, verbal tics, hedges:
   - Fillers they actually use ("honestly," "I mean," "which is kind of")
   - How they signal uncertainty vs. confidence
   - Question-then-answer patterns if present
   - First person frequency (heavy "I" usage? self-effacing? assertive?)
   List 3–5 specific markers. Generic observations ("uses first person") don't count.

3. VOCABULARY REGISTER:
   - casual: slang, contractions everywhere, informal constructions
   - mixed: casual base with occasional academic terminology
   - academic: formal constructions, discipline-specific terms, no slang

4. STRUCTURAL HABITS — Their actual patterns:
   - How do they open? (observation? question? narrative? statement?)
   - How do they close? (open question? trailing thought? neat wrap-up?)
   - Paragraph transitions? Do they use them at all?
   - Do they list things? How many items typically?
   List 3–5 specific habits.

5. SAMPLE PHRASES — Extract 3–5 phrases that ONLY this writer would use. These should be characteristic of their voice, not generic. Actual phrases, lifted directly if possible.

6. AVERAGE SENTENCE LENGTH — Rough estimate in words.

7. TONE NOTES — A 2–3 sentence description of their voice: what would make someone reading a new post immediately say "this sounds like that person"? Be specific.

Return ONLY a valid JSON object matching this exact structure:
{
  "sentence_rhythm": "short_punchy" | "medium_balanced" | "long_flowing" | "highly_variable",
  "voice_markers": ["...", "..."],
  "vocabulary_register": "casual" | "mixed" | "academic",
  "structural_habits": ["...", "..."],
  "sample_phrases": ["...", "..."],
  "avg_sentence_length": <number>,
  "tone_notes": "..."
}

No other text. No explanation. No markdown. Only the JSON object.`

/**
 * Builds the user message for style extraction.
 * Truncates samples to MAX_SAMPLE_CHARS total to control cost.
 */
export function buildStyleExtractPrompt(samples: string[]): string {
  const validSamples = samples
    .map((s) => s.trim())
    .filter((s) => s.length >= 50)

  if (validSamples.length === 0) {
    throw new Error('No valid samples provided')
  }

  let totalChars = 0
  const truncatedSamples: string[] = []

  for (const sample of validSamples) {
    const remaining = MAX_SAMPLE_CHARS - totalChars
    if (remaining <= 100) break
    const chunk = sample.slice(0, remaining)
    truncatedSamples.push(chunk)
    totalChars += chunk.length
  }

  const sampleBlocks = truncatedSamples
    .map((s, i) => `WRITING SAMPLE ${i + 1}:\n"${s}"`)
    .join('\n\n')

  return `Analyze the following ${truncatedSamples.length} writing sample(s) and extract the style fingerprint.\n\n${sampleBlocks}`
}

/**
 * Parses the Claude JSON response into a StyleFingerprint.
 * Returns null on parse failure — caller should surface the error to the user.
 */
export function parseStyleResponse(raw: string): Omit<StyleFingerprint, 'extracted_at' | 'sample_count'> | null {
  try {
    // Strip markdown code fences if Claude wraps it anyway
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    // Validate required fields
    const required = ['sentence_rhythm', 'voice_markers', 'vocabulary_register',
                      'structural_habits', 'sample_phrases', 'avg_sentence_length', 'tone_notes']
    for (const field of required) {
      if (!(field in parsed)) return null
    }

    return {
      sentence_rhythm:     parsed.sentence_rhythm,
      voice_markers:       Array.isArray(parsed.voice_markers) ? parsed.voice_markers.slice(0, 6) : [],
      vocabulary_register: parsed.vocabulary_register,
      structural_habits:   Array.isArray(parsed.structural_habits) ? parsed.structural_habits.slice(0, 6) : [],
      sample_phrases:      Array.isArray(parsed.sample_phrases) ? parsed.sample_phrases.slice(0, 5) : [],
      avg_sentence_length: typeof parsed.avg_sentence_length === 'number' ? parsed.avg_sentence_length : 15,
      tone_notes:          typeof parsed.tone_notes === 'string' ? parsed.tone_notes : '',
    }
  } catch {
    return null
  }
}

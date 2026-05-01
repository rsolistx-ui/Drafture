/**
 * DMD-016/017/018 — Style matching types.
 *
 * StyleFingerprint: extracted from a user's own writing samples.
 * Injected into generation prompts to calibrate output toward their natural voice.
 */

export interface StyleFingerprint {
  /** Dominant sentence rhythm pattern observed in their writing */
  sentence_rhythm: 'short_punchy' | 'medium_balanced' | 'long_flowing' | 'highly_variable'

  /** Recurring verbal tics, fillers, or phrasing habits specific to this writer */
  voice_markers: string[]

  /** Vocabulary register tendency */
  vocabulary_register: 'casual' | 'mixed' | 'academic'

  /** How they typically open paragraphs, close posts, transition between ideas */
  structural_habits: string[]

  /** Actual phrases lifted from their writing that feel characteristic */
  sample_phrases: string[]

  /** Rough average sentence length in words */
  avg_sentence_length: number

  /** Free-form 2–3 sentence description of their writing voice */
  tone_notes: string

  /** ISO timestamp when this fingerprint was last extracted */
  extracted_at: string

  /** Number of samples used to generate this fingerprint */
  sample_count: number
}

/** Key used to store the fingerprint in localStorage */
export const STYLE_STORAGE_KEY = 'drafture_style_v1'

/** Minimum character count for a usable sample */
export const MIN_SAMPLE_CHARS = 100

/** Maximum total characters we send to the analysis API */
export const MAX_SAMPLE_CHARS = 8000

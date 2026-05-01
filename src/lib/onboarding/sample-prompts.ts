/**
 * Pre-filled sample prompts for first-time users.
 *
 * Shown when localStorage 'drafture_seen_sample' is not set.
 * Purpose: eliminate the blank-form confusion that kills activation.
 * Users immediately understand what goes where without reading any docs.
 */

export interface SamplePromptConfig {
  prompt: string
  course: string
  classmatePost?: string
  minWords: number
  maxWords: number
}

export const SAMPLE_PROMPTS: Record<'initial' | 'classmate' | 'instructor', SamplePromptConfig> = {
  initial: {
    prompt: "Based on this week's reading, describe a time you personally encountered an ethical dilemma — in a professional, academic, or personal context. How did you navigate it, and knowing what you know now, what would you do differently?",
    course: "Introduction to Ethics",
    minWords: 250,
    maxWords: 400,
  },
  classmate: {
    prompt: "Reply to your classmate's post about ethical dilemmas.",
    course: "Introduction to Ethics",
    classmatePost: "I remember during my summer internship at a small accounting firm, I noticed my supervisor rounding numbers in ways that seemed off. When I asked about it, he said it was 'standard practice' and I shouldn't worry about it. I didn't say anything because I was afraid of losing the internship, but it bothered me for weeks. Looking back, I think I should have at least documented what I saw. The reading this week really made me think about the difference between illegal and unethical — they're not always the same thing.",
    minWords: 50,
    maxWords: 200,
  },
  instructor: {
    prompt: "Respond to your professor's feedback on your discussion post.",
    course: "Introduction to Ethics",
    classmatePost: "Good observation about the legal/ethical distinction — that's exactly the tension I wanted you to sit with. I'd push you further: do you think there's ever a moral obligation to act when you witness something technically legal but clearly wrong? What theoretical framework from our readings would you apply here?",
    minWords: 100,
    maxWords: 150,
  },
}

/**
 * Heuristic detector: infers post type from the prompt text so the selector
 * auto-updates when a user pastes a real assignment.
 *
 * Returns null if no confident signal found (user picks manually).
 */
export function detectPostType(text: string): 'initial' | 'classmate' | 'instructor' | null {
  if (!text || text.length < 10) return null

  const t = text.toLowerCase()

  // Instructor/professor reply signals
  if (
    /respond\s+to\s+(your\s+)?(instructor|professor|prof)\b/.test(t) ||
    /reply\s+to\s+(your\s+)?(instructor|professor|prof)\b/.test(t) ||
    /professor('s|s)?\s+(feedback|response|reply|post)\b/.test(t) ||
    /instructor('s|s)?\s+(feedback|response|reply|post)\b/.test(t)
  ) return 'instructor'

  // Classmate reply signals
  if (
    /respond\s+to\s+(a\s+)?(classmate|peer|fellow student)\b/.test(t) ||
    /reply\s+to\s+(a\s+)?(classmate|peer|fellow student)\b/.test(t) ||
    /classmate('s|s)?\s+(post|response|reply)\b/.test(t) ||
    /peer('s|s)?\s+(post|response|reply)\b/.test(t) ||
    /\bre:\s/.test(t)   // "Re: [post title]" pattern
  ) return 'classmate'

  // Initial post signals
  if (
    /\b(initial|first|original)\s+post\b/.test(t) ||
    /\bdiscussion\s+(post|board|question|prompt)\b/.test(t) ||
    /\bweek\s+\d+\s+(discussion|post|response)\b/.test(t) ||
    /^(based on|for this week|respond to the following|discuss)\b/.test(t.trim())
  ) return 'initial'

  return null
}

/** localStorage key for "has seen sample" flag */
export const SEEN_SAMPLE_KEY = 'drafture_seen_sample_v1'

/**
 * FORBIDDEN PATTERNS — AI Lexical Fingerprint Database
 *
 * These are words and phrases statistically overrepresented in LLM output
 * as identified by Turnitin, GPTZero, and Copyleaks detection models (2024-2026).
 * This list is the first line of defense — used in both generation and editing passes.
 *
 * Categories:
 * 1. Formal transitional connectives (AI's favorite crutch)
 * 2. AI throat-clearing / meta-commentary
 * 3. Hollow intensifiers and urgency words
 * 4. Academic-sounding but AI-overused verbs
 * 5. Vague noun constructions AI loves
 * 6. Performative balance / hedging
 * 7. Sign-off phrases
 * 8. Corporate/consultant vocabulary AI defaults to
 * 9. Overly formal preposition phrases
 * 10. Praise openers (classmate/instructor replies)
 */

export const FORBIDDEN_WORDS: string[] = [
  // ── 1. Formal transitional connectives ─────────────────────────────────────
  'furthermore', 'moreover', 'additionally', 'consequently', 'subsequently',
  'nevertheless', 'nonetheless', 'therefore', 'thus', 'hence',
  'accordingly', 'thereupon', 'henceforth', 'heretofore',
  'notwithstanding', 'inasmuch', 'insofar',

  // ── 2. AI throat-clearing / meta-commentary ────────────────────────────────
  'delve', 'delves', 'delving', 'delved',
  'unpack', 'unpacking', 'unpacks',
  'navigate', 'navigating', 'navigates',
  'underscore', 'underscores', 'underscoring',
  'illuminate', 'illuminates', 'illuminating', 'illuminated',
  'shed light', 'shedding light', 'sheds light',
  'highlight', 'highlights', 'highlighted', 'highlighting',
  'explore', 'explores', 'exploring', 'explored',
  'examine', 'examines', 'examining', 'examined',
  'address', 'addresses', 'addressing', 'addressed',
  'demonstrate', 'demonstrates', 'demonstrating', 'demonstrated',
  'illustrate', 'illustrates', 'illustrating', 'illustrated',
  'reflect', 'reflects', 'reflecting', 'reflected',    // "this reflects..."
  'signify', 'signifies', 'signifying', 'signified',
  'indicate', 'indicates', 'indicating', 'indicated',   // academic AI overuse
  'suggest', 'suggests', 'suggesting', 'suggested',     // "this suggests that..."
  'reveal', 'reveals', 'revealing', 'revealed',

  // ── 3. Hollow intensifiers and urgency words ───────────────────────────────
  'truly', 'certainly', 'undoubtedly', 'undeniably',
  'absolutely', 'profoundly', 'fundamentally', 'inherently',
  'intrinsically', 'essentially', 'inherent', 'integral',
  'profound', 'significant', 'substantial', 'considerable',
  'remarkable', 'noteworthy', 'notable', 'notably',
  'groundbreaking', 'revolutionary', 'transformative', 'unprecedented',
  'innovative', 'innovation', 'cutting-edge', 'state-of-the-art',
  'pivotal', 'paramount', 'indispensable', 'invaluable',
  'comprehensive', 'robust', 'holistic', 'synergistic', 'synergy',

  // ── 4. Academic-sounding but AI-overused verbs ────────────────────────────
  'foster', 'fosters', 'fostering', 'fostered',
  'facilitate', 'facilitates', 'facilitating', 'facilitated',
  'leverage', 'leverages', 'leveraging', 'leveraged',
  'empower', 'empowers', 'empowering', 'empowered',
  'cultivate', 'cultivates', 'cultivating', 'cultivated',
  'harness', 'harnessing', 'harnessed',
  'bolster', 'bolsters', 'bolstering', 'bolstered',
  'necessitate', 'necessitates', 'necessitating',
  'transcend', 'transcends', 'transcending', 'transcended',
  'encapsulate', 'encapsulates', 'encapsulating',
  'epitomize', 'epitomizes', 'epitomizing',

  // ── 5. Vague noun constructions AI defaults to ────────────────────────────
  'tapestry', 'landscape', 'realm', 'domain', 'sphere', 'arena',
  'paradigm', 'framework', 'dimension', 'facet', 'aspect',
  'dynamic', 'dynamics',    // used as standalone nouns
  'interplay', 'intersection', 'convergence',
  'nuance', 'nuanced', 'multifaceted', 'multidimensional',
  'complexity', 'intricacy', 'intricacies',
  'implications', 'ramifications',   // "has significant implications"
  'stakeholder', 'stakeholders',
  'myriad',    // AI loves obscure synonyms for "many"
  'plethora',  // same
  'gamut',

  // ── 6. Performative balance / hedging ─────────────────────────────────────
  'on one hand', 'on the other hand',
  'while it is true that', 'while it is important',
  'one could argue', 'some might say', 'it can be argued',
  'one might suggest', 'one might consider',
  'it is worth noting', 'it is worth mentioning', 'it is worth considering',
  'it is important to note', 'it is important to consider',
  'it should be noted', 'it should be mentioned',
  'it is interesting to note', 'it is interesting that',
  "it's important to consider", "it's worth considering",
  'we must consider', 'one must consider', 'one must acknowledge',
  'it is essential to', 'it is crucial to', 'it is vital to',
  'it goes without saying', 'needless to say',
  'without a doubt', 'without question',
  'cannot be overstated', 'cannot be understated',
  'of utmost importance', 'of paramount importance',
  'plays a crucial role', 'plays an important role', 'plays a key role',
  'plays a significant role', 'plays a vital role',
  'a testament to', 'speaks to', 'speaks volumes',
  'lies at the heart', 'at its very core', 'at its core',
  'central to', 'a fundamental aspect', 'a key aspect',
  'worthy of note', 'worthy of mention',

  // ── 7. Sign-off / conclusion phrases ─────────────────────────────────────
  'in conclusion', 'to conclude', 'in summary', 'to summarize',
  'in closing', 'to wrap up', 'in short',
  'overall', 'all in all', 'at the end of the day',
  'in essence', 'in a nutshell', 'simply put',
  'fundamentally speaking', 'at its most basic',
  'taken together', 'all things considered',
  'moving forward', 'going forward', 'looking ahead',
  'in the final analysis',

  // ── 8. Corporate/consultant vocab AI defaults to ─────────────────────────
  'key' ,           // "key aspects", "key takeaways", "key factors" — ban as adjective
  'impactful',      // not a real word and very AI
  'actionable',
  'deep dive',
  'circle back',
  'bandwidth',      // metaphorical use
  'proactive', 'proactively',
  'seamless', 'seamlessly',
  'streamline', 'streamlines',

  // ── 9. Overly formal preposition phrases ─────────────────────────────────
  'in terms of',       // extremely common AI filler
  'with respect to',
  'with regard to',
  'in light of',
  'in the context of',
  'in the realm of',
  'across various', 'across different', 'across a range of',
  'a wide range of', 'a wide variety of',
  'as a result',   // transition
  'as such',       // transition
  'in today\'s world', 'in today\'s society', 'in modern society',
  "in today's fast-paced", "in today's interconnected",
  'throughout history', 'since the dawn of',
  'in the modern era', 'in contemporary society',
  'given the importance of',

  // ── 10. Praise openers (for reply types) ─────────────────────────────────
  'great post', 'great point', 'excellent point', 'excellent post',
  'wonderful post', 'wonderful point', 'fantastic post',
  'interesting perspective', 'insightful post', 'very insightful',
  'i really enjoyed', 'i loved reading', 'i found your post',
  'you make an excellent', 'you make a great', 'you make a valid',
  'i completely agree', 'i totally agree', 'i wholeheartedly agree',
  'i appreciate your', 'thank you for sharing',
  'what a great', 'what an interesting',
]

/**
 * STRUCTURAL ANTI-PATTERNS
 * These are not word-level but construction-level tells.
 * Used as reference for the humanizer editing pass.
 */
export const FORBIDDEN_CONSTRUCTIONS = [
  // Pattern of threes — AI almost always lists exactly 3 items
  'three-item-list',

  // Em dash as sentence connector
  'em-dash-connector',

  // Perfect parallel structure — "not only X but also Y"
  'not only X but also Y',

  // Subject + "plays a role in" + object
  'plays a [adj] role',

  // Gerund opener that's AI-patterned
  'opening-gerund',    // "Looking at...", "Considering...", "Examining..."

  // Nested relative clauses — "which is X, which means Y, which leads to Z"
  'nested-relative-clause',

  // Uniform paragraph openers — every paragraph starting the same syntactic way
  'uniform-paragraph-openers',

  // The "X is Y" definition sentence that opens a paragraph
  'definitional-paragraph-opener',    // "Cognitive dissonance is the psychological..."
]

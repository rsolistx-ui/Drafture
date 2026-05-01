import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getTranscriptFromUrl } from '@/lib/video/transcript'
import { searchForVideoContent } from '@/lib/video/search'
import { trackServer } from '@/lib/analytics/events'
import { rateLimit, getClientIp, LIMITS } from '@/lib/rate-limit'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const TRANSCRIPT_SUMMARIZE_PROMPT = `You are an academic study assistant helping a college student prepare for a discussion post based on an assigned video. Extract the most important points from the transcript.

Output a clean bullet-point list using dashes. Rules:

CONTENT RULES:
- 8 to 12 bullets total
- Every bullet must be a specific, concrete idea — not a vague theme
- Prioritize: core arguments, key examples, memorable quotes or statistics, named theories or frameworks, cause-and-effect relationships the instructor emphasized
- Flag anything that sounds like a testable fact with a 📌 prefix (specific names, dates, statistics, definitions, named theories)
- If the instructor directly posed a discussion question or asked students to reflect on something, include it as the final bullet with a 🎯 prefix
- Write in plain student language — not textbook prose

FORMAT RULES:
- Use dashes for bullets, not numbers
- No timestamps
- No meta-commentary about the video
- No vague bullets like "the video discusses X" — state the actual idea`

const WEB_CONTENT_SUMMARIZE_PROMPT = `You are an academic study assistant. A student needs key points about a course topic but the original video was unavailable. You have web search results about the topic. Compile the most academically relevant information into a study-ready bullet list.

Output a clean bullet-point list using dashes. Rules:

CONTENT RULES:
- 8 to 12 bullets total
- Focus on: core concepts, key definitions, important examples, notable theories or frameworks, commonly tested facts
- Flag anything that is likely to appear on a quiz or test with a 📌 prefix (definitions, named theories, statistics, specific people or dates)
- Flag any discussion-style questions with a 🎯 prefix
- Synthesize across sources — don't repeat the same point twice
- Write in plain student language

FORMAT RULES:
- Use dashes for bullets
- No source citations inline
- No meta-commentary
- Start with the most important conceptual point, not a definition`

export async function POST(req: Request) {
  // Rate limiting — video fetches hit external services + Claude
  const ip = getClientIp(req)
  const rl = await rateLimit(ip, LIMITS.video)
  if (!rl.allowed) {
    return NextResponse.json({ error: rl.message }, { status: 429 })
  }

  try {
    const { url, course } = await req.json()

    if (!url?.trim()) {
      return NextResponse.json({ error: 'Video URL is required' }, { status: 400 })
    }

    const courseContext = course ? ` The course is: ${course}.` : ''
    let contentToSummarize = ''
    let systemPrompt = TRANSCRIPT_SUMMARIZE_PROMPT
    let sourceLabel = ''
    let method = 'transcript'

    // ── Stage 1: Try direct transcript ────────────────────────────────────────
    const directResult = await getTranscriptFromUrl(url.trim())

    if (directResult.success && directResult.transcript) {
      contentToSummarize = directResult.transcript.slice(0, 12000)
      sourceLabel = 'Transcript pulled directly from video'
      method = 'transcript'
    } else {
      // ── Stage 2: Fallback — search the web ──────────────────────────────────
      const searchResult = await searchForVideoContent(url.trim(), course)

      if (!searchResult.success) {
        return NextResponse.json(
          {
            error: searchResult.error || 'Could not retrieve video content. Try pasting a YouTube link directly.',
            stage: 'all_failed',
          },
          { status: 422 }
        )
      }

      sourceLabel = searchResult.sourceLabel

      if (searchResult.method === 'youtube_found' && searchResult.transcript) {
        contentToSummarize = searchResult.transcript.slice(0, 12000)
        systemPrompt = TRANSCRIPT_SUMMARIZE_PROMPT
        method = 'youtube_found'
      } else if (searchResult.method === 'web_content' && searchResult.webContent) {
        contentToSummarize = searchResult.webContent
        systemPrompt = WEB_CONTENT_SUMMARIZE_PROMPT
        method = 'web_content'
      }
    }

    if (!contentToSummarize) {
      return NextResponse.json(
        { error: 'Could not retrieve enough content to summarize.' },
        { status: 422 }
      )
    }

    // ── Stage 3: Summarize with Claude ────────────────────────────────────────
    const userMessage =
      method === 'web_content'
        ? `Here is web content about a course topic.${courseContext} Compile study-ready bullet points with quiz/test items flagged.\n\nCONTENT:\n${contentToSummarize}`
        : `Here is the transcript from an assigned course video.${courseContext} Extract key discussion and study points.\n\nTRANSCRIPT:\n${contentToSummarize}`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const bullets = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    // ── DMD-097: Track successful fetch ────────────────────────────────────────
    trackServer({
      event_name: 'video_transcript_fetched',
      event_data: { method: method as 'transcript' | 'youtube_found' | 'web_content', success: true },
    }).catch(() => {})

    return NextResponse.json({
      bullets,
      method,
      sourceLabel,
    })
  } catch (error) {
    console.error('Video processing error:', error)
    trackServer({
      event_name: 'video_transcript_fetched',
      event_data: {
        method: 'transcript',
        success: false,
        error_type: error instanceof Error ? error.constructor.name : 'unknown',
      },
    }).catch(() => {})
    return NextResponse.json({ error: 'Failed to process video.' }, { status: 500 })
  }
}

import { tavily } from '@tavily/core'
import { extractYouTubeId, fetchYouTubeTranscript } from './transcript'

export interface SearchFallbackResult {
  success: boolean
  method: 'youtube_found' | 'web_content' | 'failed'
  transcript?: string   // raw transcript if a video was found
  webContent?: string   // aggregated text from search results if no transcript
  sourceLabel: string   // shown to user so they know how the content was sourced
  error?: string
}

function buildTavilyClient() {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) throw new Error('TAVILY_API_KEY is not set')
  return tavily({ apiKey })
}

/**
 * Attempts to extract a human-readable title or topic from a URL.
 * Used as the search query when the direct transcript fetch fails.
 */
export function buildSearchQueryFromUrl(url: string, course?: string): string {
  const courseHint = course ? ` ${course}` : ''

  // Try to pull a readable slug from the URL path
  try {
    const parsed = new URL(url)
    const pathParts = parsed.pathname.split('/').filter(Boolean)
    const slug = pathParts[pathParts.length - 1]
      ?.replace(/[-_]/g, ' ')
      ?.replace(/\.\w+$/, '') // remove file extension
      ?.trim()

    if (slug && slug.length > 4) {
      return `${slug}${courseHint} lecture video`
    }
  } catch {
    // URL parsing failed — fall through
  }

  return `course lecture video${courseHint}`
}

/**
 * Searches the web for the video, first trying to find a YouTube version
 * (to get a proper transcript), then falling back to collecting summary content.
 */
export async function searchForVideoContent(
  originalUrl: string,
  course?: string,
  videoTitle?: string
): Promise<SearchFallbackResult> {
  let client
  try {
    client = buildTavilyClient()
  } catch {
    return {
      success: false,
      method: 'failed',
      sourceLabel: 'Search unavailable',
      error: 'Search service is not configured. Add TAVILY_API_KEY to enable this feature.',
    }
  }

  const baseQuery = videoTitle || buildSearchQueryFromUrl(originalUrl, course)

  // ── Step 1: Search for a YouTube version of the video ──────────────────────
  try {
    const ytSearch = await client.search(
      `site:youtube.com ${baseQuery}`,
      {
        maxResults: 5,
        searchDepth: 'basic',
        includeAnswer: false,
      }
    )

    for (const result of ytSearch.results ?? []) {
      const ytId = extractYouTubeId(result.url)
      if (!ytId) continue

      try {
        const transcript = await fetchYouTubeTranscript(ytId)
        if (transcript && transcript.trim().length > 100) {
          return {
            success: true,
            method: 'youtube_found',
            transcript,
            sourceLabel: `Transcript from matching YouTube video: ${result.url}`,
          }
        }
      } catch {
        // This video didn't have captions — keep trying
        continue
      }
    }
  } catch {
    // YouTube search failed — fall through to web content search
  }

  // ── Step 2: Search for summaries, study guides, course content ─────────────
  try {
    const contentQuery = `${baseQuery} summary key points study guide quiz`
    const webSearch = await client.search(contentQuery, {
      maxResults: 5,
      searchDepth: 'advanced', // deep crawl for richer content
      includeAnswer: true,
      includeRawContent: false,
    })

    const pieces: string[] = []

    if (webSearch.answer) {
      pieces.push(`Overview: ${webSearch.answer}`)
    }

    for (const result of webSearch.results ?? []) {
      if (result.content && result.content.trim().length > 100) {
        pieces.push(`[${result.title}]\n${result.content.trim()}`)
      }
    }

    if (pieces.length === 0) {
      return {
        success: false,
        method: 'failed',
        sourceLabel: 'No content found',
        error: 'Could not find the video or related content on the web. Try pasting a YouTube link directly if one is available.',
      }
    }

    const webContent = pieces.join('\n\n').slice(0, 10000)

    return {
      success: true,
      method: 'web_content',
      webContent,
      sourceLabel: 'Key points compiled from web search (no transcript available)',
    }
  } catch {
    return {
      success: false,
      method: 'failed',
      sourceLabel: 'Search failed',
      error: 'Web search encountered an error. Please try again or paste a YouTube link directly.',
    }
  }
}

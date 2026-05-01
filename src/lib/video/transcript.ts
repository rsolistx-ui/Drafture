import { YoutubeTranscript } from 'youtube-transcript'

export type VideoSource = 'youtube' | 'direct' | 'unsupported'

export interface TranscriptResult {
  success: boolean
  source: VideoSource
  transcript?: string
  error?: string
}

/**
 * Extracts a YouTube video ID from any YouTube URL variant or Kaltura/Canvas embed
 * that wraps a YouTube video.
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    // Standard watch URL
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // Embed URL
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    // Shorts
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    // YouTube nocookie
    /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }

  return null
}

/**
 * Detects the video source type from a URL.
 */
export function detectVideoSource(url: string): VideoSource {
  if (!url) return 'unsupported'

  const lower = url.toLowerCase()

  if (
    lower.includes('youtube.com') ||
    lower.includes('youtu.be') ||
    lower.includes('youtube-nocookie.com')
  ) {
    return 'youtube'
  }

  // Direct video file
  if (lower.match(/\.(mp4|webm|mov|avi|mkv)(\?|$)/)) {
    return 'direct'
  }

  // Kaltura/Panopto often embed YouTube — we can't reach the source directly
  return 'unsupported'
}

/**
 * Fetches and returns the full transcript text from a YouTube video.
 */
export async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  const segments = await YoutubeTranscript.fetchTranscript(videoId)
  return segments.map((s) => s.text).join(' ')
}

/**
 * Main entry point — given any URL, attempts to get a transcript.
 */
export async function getTranscriptFromUrl(url: string): Promise<TranscriptResult> {
  const source = detectVideoSource(url)

  if (source === 'youtube') {
    const videoId = extractYouTubeId(url)
    if (!videoId) {
      return { success: false, source, error: 'Could not extract YouTube video ID from that URL.' }
    }

    try {
      const transcript = await fetchYouTubeTranscript(videoId)
      if (!transcript || transcript.trim().length < 50) {
        return { success: false, source, error: 'This video does not have captions or a transcript available.' }
      }
      return { success: true, source, transcript }
    } catch {
      return {
        success: false,
        source,
        error: 'Could not fetch transcript. The video may have captions disabled or be age-restricted.',
      }
    }
  }

  if (source === 'direct') {
    return {
      success: false,
      source,
      error: 'Direct video file transcription is not yet supported. Try a YouTube link if one is available.',
    }
  }

  return {
    success: false,
    source: 'unsupported',
    error: 'This video source is not supported. If the video is on Canvas or Blackboard, look for an embedded YouTube link and paste that instead.',
  }
}

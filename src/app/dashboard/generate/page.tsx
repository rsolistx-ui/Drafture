'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileText, Zap, Copy, CheckCheck, RotateCcw, PlayCircle, Loader2, ChevronDown, ChevronUp, Sparkles, Paperclip, X, BookOpen, ThumbsUp, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { track } from '@/lib/analytics/client'
import DashboardSidebar from '@/components/DashboardSidebar'
import { SAMPLE_PROMPTS, detectPostType, SEEN_SAMPLE_KEY } from '@/lib/onboarding/sample-prompts'
import type { StyleFingerprint } from '@/lib/style/types'
import { STYLE_STORAGE_KEY } from '@/lib/style/types'
import { listNoteSets, notesContextSnippet, type SavedNoteSet } from '@/lib/notes/storage'
import { recordGeneration } from '@/lib/usage/storage'

const STYLE_ENABLED_KEY = 'drafture_style_enabled_v1'

const POST_TYPES = [
  { id: 'initial',    label: 'Initial Post',          description: 'Your original response to the prompt' },
  { id: 'classmate',  label: 'Reply to Classmate',    description: "Responding to a fellow student's post" },
  { id: 'instructor', label: 'Reply to Instructor',   description: "Responding to your professor's feedback" },
]

const TONES = [
  { id: 'thoughtful', label: 'Thoughtful & Analytical' },
  { id: 'casual',     label: 'Casual but Informed' },
  { id: 'formal',     label: 'Formal & Academic' },
]

const WORD_COUNT_DEFAULTS: Record<string, { min: number; max: number }> = {
  initial:    { min: 250, max: 400 },
  classmate:  { min: 50,  max: 200 },
  instructor: { min: 100, max: 150 },
}

export default function GeneratePage() {
  const [prompt, setPrompt] = useState('')
  const [postType, setPostType] = useState<'initial' | 'classmate' | 'instructor'>('initial')
  const [tone, setTone] = useState('thoughtful')
  const [minWords, setMinWords] = useState(250)
  const [maxWords, setMaxWords] = useState(400)
  const [course, setCourse] = useState('')
  const [classmatePost, setClassmatePost] = useState('')
  const [professorCriteria, setProfessorCriteria] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoBullets, setVideoBullets] = useState('')
  const [videoMethod, setVideoMethod] = useState<string>('')
  const [videoSourceLabel, setVideoSourceLabel] = useState<string>('')
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoError, setVideoError] = useState('')
  const [bulletsExpanded, setBulletsExpanded] = useState(true)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [wordCount, setWordCount] = useState<number | null>(null)
  const [wordTarget, setWordTarget] = useState<string>('')
  const [wordCountInRange, setWordCountInRange] = useState<boolean | null>(null)
  const generatedAtRef = useRef<number | null>(null)

  // ── Instructor/classmate PDF attachment ───────────────────────────────────
  const [attachedPdf, setAttachedPdf] = useState<{ name: string; base64: string } | null>(null)
  const [pdfFileError, setPdfFileError] = useState('')
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // ── Course notes library ───────────────────────────────────────────────────
  const [notesLibrary, setNotesLibrary] = useState<SavedNoteSet[]>([])
  const [selectedNotesId, setSelectedNotesId] = useState<string>('')

  // ── Generation context snapshot (captured at generate-time for analytics) ─
  const [generationCtx, setGenerationCtx] = useState<{
    hadCourseNotes: boolean
    hadVideo: boolean
    hadStyle: boolean
    hadPdf: boolean
    promptVersion: string
  } | null>(null)
  const [thumbed, setThumbed] = useState(false)

  // ── Refinement state ───────────────────────────────────────────────────────
  const [refineFeedback, setRefineFeedback] = useState('')
  const [refineExpanded, setRefineExpanded] = useState(false)
  const [refining, setRefining] = useState(false)

  // ── Style matching state ──────────────────────────────────────────────────
  const [styleFingerprint, setStyleFingerprint] = useState<StyleFingerprint | null>(null)
  const [styleEnabled, setStyleEnabled] = useState(false)

  // ── Onboarding pre-fill + style load ─────────────────────────────────────
  useEffect(() => {
    try {
      // Load notes library
      setNotesLibrary(listNoteSets())

      // Load style fingerprint
      const stored = localStorage.getItem(STYLE_STORAGE_KEY)
      if (stored) {
        const fp = JSON.parse(stored) as StyleFingerprint
        setStyleFingerprint(fp)
        // Default to enabled if fingerprint exists
        const enabledFlag = localStorage.getItem(STYLE_ENABLED_KEY)
        setStyleEnabled(enabledFlag !== 'false')
      }

      // First-visit sample pre-fill
      const seenSample = localStorage.getItem(SEEN_SAMPLE_KEY)
      if (!seenSample) {
        const sample = SAMPLE_PROMPTS.initial
        setPrompt(sample.prompt)
        setCourse(sample.course)
        setPostType('initial')
        const defaults = WORD_COUNT_DEFAULTS.initial
        setMinWords(sample.minWords ?? defaults.min)
        setMaxWords(sample.maxWords ?? defaults.max)
        // Mark as seen so it doesn't pre-fill again
        localStorage.setItem(SEEN_SAMPLE_KEY, '1')
      }
    } catch {
      // localStorage unavailable — SSR safety
    }
  }, [])

  // ── Auto post-type detection on prompt change ─────────────────────────────
  const handlePromptChange = (value: string) => {
    setPrompt(value)
    const detected = detectPostType(value)
    if (detected && detected !== postType) {
      setPostType(detected)
      const defaults = WORD_COUNT_DEFAULTS[detected]
      setMinWords(defaults.min)
      setMaxWords(defaults.max)
      // Pre-fill classmate post if sample config has one
      const sampleConfig = SAMPLE_PROMPTS[detected]
      if (sampleConfig.classmatePost && !classmatePost) {
        setClassmatePost(sampleConfig.classmatePost)
      }
    }
  }

  const handlePostTypeChange = (type: string) => {
    setPostType(type as typeof postType)
    const defaults = WORD_COUNT_DEFAULTS[type] ?? WORD_COUNT_DEFAULTS.initial
    setMinWords(defaults.min)
    setMaxWords(defaults.max)
  }

  const handleWordCountChange = (field: 'min' | 'max', value: number) => {
    const defaults = WORD_COUNT_DEFAULTS[postType] ?? WORD_COUNT_DEFAULTS.initial
    const isNonDefault = field === 'min' ? value !== defaults.min : value !== defaults.max
    if (isNonDefault) {
      track({
        event_name: 'word_count_customized',
        event_data: {
          post_type: postType,
          default_min: defaults.min,
          default_max: defaults.max,
          custom_min: field === 'min' ? value : minWords,
          custom_max: field === 'max' ? value : maxWords,
        },
      })
    }
  }

  const handlePdfAttach = async (file: File) => {
    setPdfFileError('')
    if (file.type !== 'application/pdf') {
      setPdfFileError('Only PDF files are supported.')
      return
    }
    const MAX_BYTES = 15 * 1024 * 1024
    if (file.size > MAX_BYTES) {
      setPdfFileError(`"${file.name}" is too large. Maximum size is 15MB.`)
      return
    }
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1])
        }
        reader.onerror = () => reject(new Error('Read failed'))
        reader.readAsDataURL(file)
      })
      setAttachedPdf({ name: file.name, base64 })
    } catch {
      setPdfFileError(`Could not read "${file.name}". Please try again.`)
    }
  }

  const handlePdfRemove = () => {
    setAttachedPdf(null)
    setPdfFileError('')
    if (pdfInputRef.current) pdfInputRef.current.value = ''
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setResult('')
    setGenerationCtx(null)
    setThumbed(false)
    setRefineFeedback('')
    setRefineExpanded(false)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          postType,
          tone,
          course,
          classmatePost,
          professorCriteria,
          videoSummary: videoBullets,
          minWords,
          maxWords,
          // DMD-018: pass style fingerprint if enabled
          styleFingerprint: styleEnabled && styleFingerprint ? styleFingerprint : null,
          // PDF attachment for classmate/instructor reply context
          instructorPdfBase64: attachedPdf?.base64 ?? null,
          // Course notes context from saved library
          courseNotes: (() => {
            if (!selectedNotesId) return null
            const set = notesLibrary.find(s => s.id === selectedNotesId)
            return set ? notesContextSnippet(set.notes) : null
          })(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult(data.error || 'Something went wrong. Please try again.')
        return
      }
      setResult(data.content || 'Something went wrong. Please try again.')
      if (data.wordCount) setWordCount(data.wordCount)
      if (data.wordTarget) setWordTarget(data.wordTarget)
      if (data.wordCountInRange !== undefined) setWordCountInRange(data.wordCountInRange)
      generatedAtRef.current = Date.now()
      // Track usage for dashboard counter
      try { recordGeneration() } catch { /* ok */ }
      // Capture context snapshot for badges + feedback analytics
      setGenerationCtx({
        hadCourseNotes: !!selectedNotesId,
        hadVideo: !!(videoBullets?.trim()),
        hadStyle: !!(styleEnabled && styleFingerprint),
        hadPdf: !!attachedPdf,
        promptVersion: data.promptVersion ?? '',
      })
    } catch {
      setResult('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    track({
      event_name: 'post_copied',
      event_data: {
        post_type: postType,
        word_count: wordCount ?? 0,
        ms_since_generated: generatedAtRef.current ? Date.now() - generatedAtRef.current : 0,
      },
    })
  }

  const handleThumbsUp = () => {
    if (thumbed || !generationCtx) return
    setThumbed(true)
    track({
      event_name: 'post_quality_rated',
      event_data: {
        rating: 'good',
        post_type: postType,
        prompt_version: generationCtx.promptVersion,
        had_course_notes: generationCtx.hadCourseNotes,
        had_video_summary: generationCtx.hadVideo,
        had_style: generationCtx.hadStyle,
        had_pdf: generationCtx.hadPdf,
        word_count: wordCount ?? 0,
        ms_since_generated: generatedAtRef.current ? Date.now() - generatedAtRef.current : 0,
      },
    })
  }

  const handleRefine = async () => {
    if (!refineFeedback.trim() || !result) return
    setRefining(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          postType,
          tone,
          course,
          classmatePost,
          professorCriteria,
          videoSummary: videoBullets,
          minWords,
          maxWords,
          styleFingerprint: styleEnabled && styleFingerprint ? styleFingerprint : null,
          instructorPdfBase64: attachedPdf?.base64 ?? null,
          courseNotes: (() => {
            if (!selectedNotesId) return null
            const set = notesLibrary.find(s => s.id === selectedNotesId)
            return set ? notesContextSnippet(set.notes) : null
          })(),
          // Refinement params — triggers targeted revision path in the API
          refineFeedback: refineFeedback.trim(),
          previousDraft:  result,
        }),
      })
      const data = await res.json()
      if (!res.ok) return // silently preserve the original draft on error
      setResult(data.content || result)
      if (data.wordCount !== undefined) setWordCount(data.wordCount)
      if (data.wordTarget)              setWordTarget(data.wordTarget)
      if (data.wordCountInRange !== undefined) setWordCountInRange(data.wordCountInRange)
      generatedAtRef.current = Date.now()
      // Reset feedback fields after a successful refine
      setRefineFeedback('')
      setRefineExpanded(false)
      setThumbed(false)
    } catch {
      // Network failure — original result is preserved, nothing to show
    } finally {
      setRefining(false)
    }
  }

  const handleVideoFetch = async () => {
    if (!videoUrl.trim()) return
    setVideoLoading(true)
    setVideoError('')
    setVideoBullets('')
    setVideoMethod('')
    setVideoSourceLabel('')
    try {
      const res = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl, course }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setVideoError(data.error || 'Could not process this video.')
      } else {
        setVideoBullets(data.bullets)
        setVideoMethod(data.method || 'transcript')
        setVideoSourceLabel(data.sourceLabel || '')
        setBulletsExpanded(true)
      }
    } catch {
      setVideoError('Something went wrong. Please try again.')
    } finally {
      setVideoLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#070e21' }}>
      <DashboardSidebar />

      {/* Main */}
      <div className="ml-64 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold" style={{ color: '#e0e9ff' }}>New post</h1>
            <p className="mt-1" style={{ color: '#5a7dc4' }}>Fill in what your professor gave you. We&apos;ll handle the rest.</p>
          </div>

          {/* Style matching banner */}
          {styleFingerprint && (
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3 mb-6"
              style={
                styleEnabled
                  ? { backgroundColor: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)' }
                  : { backgroundColor: 'rgba(26,58,110,0.3)', border: '1px solid rgba(26,58,110,0.5)' }
              }
            >
              <div className="flex items-center gap-2.5">
                <Sparkles
                  className="w-4 h-4 shrink-0"
                  style={{ color: styleEnabled ? '#9775fa' : '#5a7dc4' }}
                />
                <span
                  className="text-sm font-semibold"
                  style={{ color: styleEnabled ? '#b8a4ff' : '#5a7dc4' }}
                >
                  {styleEnabled ? 'Your style is active' : 'Your style is paused'}
                </span>
                <span
                  className="text-xs"
                  style={{ color: styleEnabled ? '#7c6dc4' : '#2d5299' }}
                >
                  {styleEnabled
                    ? '— posts will sound like you'
                    : '— posts will use default voice'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const next = !styleEnabled
                    setStyleEnabled(next)
                    try {
                      localStorage.setItem(STYLE_ENABLED_KEY, next ? 'true' : 'false')
                    } catch { /* ok */ }
                  }}
                  className="text-xs font-semibold transition-colors hover:opacity-80"
                  style={{ color: styleEnabled ? '#9775fa' : '#5a7dc4' }}
                >
                  {styleEnabled ? 'Pause' : 'Enable'}
                </button>
                <Link
                  href="/dashboard/style"
                  className="text-xs transition-colors hover:opacity-80"
                  style={{ color: '#5a7dc4' }}
                >
                  Edit →
                </Link>
              </div>
            </div>
          )}

          {/* Course notes active banner */}
          {selectedNotesId && notesLibrary.find(s => s.id === selectedNotesId) && (
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3 mb-4"
              style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 shrink-0" style={{ color: '#34d399' }} />
                <span className="text-sm font-semibold" style={{ color: '#6ee7b7' }}>
                  Course notes active
                </span>
                <span className="text-xs" style={{ color: '#059669' }}>
                  — {notesLibrary.find(s => s.id === selectedNotesId)!.label} · Claude will draw on this chapter material
                </span>
              </div>
              <button
                onClick={() => setSelectedNotesId('')}
                className="text-xs font-semibold transition-colors hover:opacity-80"
                style={{ color: '#34d399' }}
              >
                Remove
              </button>
            </div>
          )}

          {!styleFingerprint && (
            <Link href="/dashboard/style">
              <div
                className="flex items-center justify-between rounded-xl px-4 py-3 mb-6 cursor-pointer transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'rgba(124,58,237,0.08)', border: '1px dashed rgba(124,58,237,0.3)' }}
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 shrink-0" style={{ color: '#7c3aed' }} />
                  <div>
                    <span className="text-sm font-semibold" style={{ color: '#9775fa' }}>
                      Set up your writing style
                    </span>
                    <span className="text-xs ml-2" style={{ color: '#5a7dc4' }}>
                      Posts will sound more like you, less like AI
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold" style={{ color: '#7c3aed' }}>Set up →</span>
              </div>
            </Link>
          )}

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Input panel */}
            <div className="space-y-6">
              {/* Post type */}
              <div className="rounded-2xl p-6" style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}>
                <h3 className="font-bold mb-4" style={{ color: '#e0e9ff' }}>Post type</h3>
                <div className="space-y-2">
                  {POST_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => handlePostTypeChange(type.id)}
                      className={cn('w-full text-left px-4 py-3 rounded-xl border-2 transition-all duration-150')}
                      style={postType === type.id
                        ? { borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.15)' }
                        : { borderColor: 'rgba(26,58,110,0.6)', backgroundColor: 'transparent' }
                      }
                    >
                      <div
                        className="font-semibold text-sm"
                        style={{ color: postType === type.id ? '#b8a4ff' : '#94afee' }}
                      >
                        {type.label}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: '#5a7dc4' }}>{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt */}
              <div className="rounded-2xl p-6" style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}>
                <h3 className="font-bold mb-1" style={{ color: '#e0e9ff' }}>Professor&apos;s prompt</h3>
                <p className="text-sm mb-4" style={{ color: '#5a7dc4' }}>Paste the discussion question exactly as written.</p>
                <textarea
                  value={prompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  placeholder="e.g. Based on this week's reading, discuss how social media has changed political discourse. Include at least one real-world example..."
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 transition-all"
                  style={{
                    backgroundColor: 'rgba(7,14,33,0.8)',
                    border: '1px solid rgba(26,58,110,0.8)',
                    color: '#e0e9ff',
                    '--tw-ring-color': '#7c3aed',
                  } as React.CSSProperties}
                />
              </div>

              {/* Video URL */}
              <div className="rounded-2xl p-6" style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <PlayCircle className="w-4 h-4" style={{ color: '#ef4444' }} />
                  <h3 className="font-bold" style={{ color: '#e0e9ff' }}>
                    Video link <span className="font-normal text-sm" style={{ color: '#5a7dc4' }}>(optional)</span>
                  </h3>
                </div>
                <p className="text-sm mb-4" style={{ color: '#5a7dc4' }}>
                  Paste a YouTube link and we&apos;ll pull the transcript so you don&apos;t have to watch it.
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => { setVideoUrl(e.target.value); setVideoError(''); setVideoBullets('') }}
                    placeholder="https://youtube.com/watch?v=..."
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                    style={{
                      backgroundColor: 'rgba(7,14,33,0.8)',
                      border: '1px solid rgba(26,58,110,0.8)',
                      color: '#e0e9ff',
                      '--tw-ring-color': '#7c3aed',
                    } as React.CSSProperties}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVideoFetch}
                    disabled={!videoUrl.trim() || videoLoading}
                    className="shrink-0 gap-1.5"
                    style={{ borderColor: 'rgba(124,58,237,0.4)', color: '#9775fa' }}
                  >
                    {videoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                    {videoLoading ? 'Fetching...' : 'Get transcript'}
                  </Button>
                </div>

                {videoError && (
                  <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{videoError}</p>
                )}

                {videoBullets && (
                  <div
                    className="mt-4 rounded-xl overflow-hidden"
                    style={{ backgroundColor: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }}
                  >
                    <button
                      onClick={() => setBulletsExpanded(!bulletsExpanded)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors"
                      style={{ color: '#b8a4ff' }}
                    >
                      <span>✅ Key points extracted — included in your post</span>
                      {bulletsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {bulletsExpanded && (
                      <div className="px-4 pb-4">
                        <div className="mb-3 flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            videoMethod === 'transcript' ? 'bg-green-900/50 text-green-300' :
                            videoMethod === 'youtube_found' ? 'bg-blue-900/50 text-blue-300' :
                            'bg-amber-900/50 text-amber-300'
                          }`}>
                            {videoMethod === 'transcript' ? '📼 Direct transcript' :
                             videoMethod === 'youtube_found' ? '🔍 YouTube match found' :
                             '🌐 Web search'}
                          </span>
                          {videoSourceLabel && (
                            <span className="text-xs truncate" style={{ color: '#9775fa' }}>{videoSourceLabel}</span>
                          )}
                        </div>
                        <div className="flex gap-3 mb-3 text-xs" style={{ color: '#9775fa' }}>
                          <span>📌 likely on a quiz/test</span>
                          <span>🎯 discussion prompt</span>
                        </div>
                        <ul className="space-y-2">
                          {videoBullets.split('\n').filter(Boolean).map((line, i) => (
                            <li key={i} className="text-xs leading-relaxed flex gap-2" style={{ color: '#c4d4ff' }}>
                              <span className="mt-0.5 shrink-0" style={{ color: '#5a7dc4' }}>—</span>
                              <span>{line.replace(/^[-•]\s*/, '')}</span>
                            </li>
                          ))}
                        </ul>
                        {videoMethod === 'web_content' && (
                          <p className="mt-3 text-xs rounded-lg px-3 py-2" style={{ color: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                            ⚠️ Original video was unavailable — these points were compiled from web sources. Cross-check against your course material.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Classmate / Instructor post (conditional) */}
              {(postType === 'classmate' || postType === 'instructor') && (
                <div className="rounded-2xl p-6" style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}>
                  <h3 className="font-bold mb-1" style={{ color: '#e0e9ff' }}>
                    {postType === 'classmate' ? "Classmate's post" : "Instructor's response"}
                  </h3>
                  <p className="text-sm mb-4" style={{ color: '#5a7dc4' }}>
                    {postType === 'classmate'
                      ? 'Paste what your classmate wrote so we can reply to it.'
                      : 'Paste what your instructor wrote so we can reply to it.'}
                  </p>
                  <textarea
                    value={classmatePost}
                    onChange={(e) => setClassmatePost(e.target.value)}
                    onBlur={(e) => {
                      if (e.target.value.trim().length > 10) {
                        track({
                          event_name: 'classmate_post_added',
                          event_data: {
                            char_count: e.target.value.length,
                            post_type: postType as 'classmate' | 'instructor',
                          },
                        })
                      }
                    }}
                    placeholder={postType === 'classmate' ? "Paste your classmate's post here..." : "Paste your instructor's response here..."}
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 transition-all"
                    style={{
                      backgroundColor: 'rgba(7,14,33,0.8)',
                      border: '1px solid rgba(26,58,110,0.8)',
                      color: '#e0e9ff',
                      '--tw-ring-color': '#7c3aed',
                    } as React.CSSProperties}
                  />

                  {/* PDF attachment */}
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(26,58,110,0.6)' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: '#5a7dc4' }}>
                      PDF attachment{' '}
                      <span className="font-normal" style={{ color: '#2d5299' }}>
                        (optional — attach a rubric, feedback doc, or reading)
                      </span>
                    </p>

                    {attachedPdf ? (
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-xl"
                        style={{
                          backgroundColor: 'rgba(124,58,237,0.1)',
                          border: '1px solid rgba(124,58,237,0.3)',
                        }}
                      >
                        <Paperclip className="w-3.5 h-3.5 shrink-0" style={{ color: '#9775fa' }} />
                        <span className="text-xs font-medium flex-1 truncate" style={{ color: '#c4d4ff' }}>
                          {attachedPdf.name}
                        </span>
                        <button
                          onClick={handlePdfRemove}
                          className="shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
                          style={{ color: '#5a7dc4' }}
                          aria-label="Remove PDF"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label
                        className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors hover:border-violet-500/40"
                        style={{
                          border: '1px dashed rgba(26,58,110,0.8)',
                          backgroundColor: 'rgba(7,14,33,0.4)',
                          display: 'inline-flex',
                        }}
                      >
                        <Paperclip className="w-3.5 h-3.5" style={{ color: '#5a7dc4' }} />
                        <span className="text-xs font-semibold" style={{ color: '#5a7dc4' }}>
                          Attach PDF
                        </span>
                        <input
                          ref={pdfInputRef}
                          type="file"
                          accept="application/pdf"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handlePdfAttach(file)
                          }}
                        />
                      </label>
                    )}

                    {pdfFileError && (
                      <p className="mt-1.5 text-xs" style={{ color: '#ef4444' }}>{pdfFileError}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Course notes (only shown when library has entries) */}
              {notesLibrary.length > 0 && (
                <div className="rounded-2xl p-6" style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-4 h-4" style={{ color: '#9775fa' }} />
                    <h3 className="font-bold" style={{ color: '#e0e9ff' }}>
                      Course notes <span className="font-normal text-sm" style={{ color: '#5a7dc4' }}>(optional)</span>
                    </h3>
                  </div>
                  <p className="text-sm mb-4" style={{ color: '#5a7dc4' }}>
                    Select a saved note set and Claude will draw on the chapter material when writing your post.
                  </p>

                  <div className="space-y-2">
                    {/* None option */}
                    <button
                      onClick={() => setSelectedNotesId('')}
                      className="w-full text-left px-4 py-2.5 rounded-xl border-2 transition-all text-sm"
                      style={!selectedNotesId
                        ? { borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.15)', color: '#b8a4ff', fontWeight: 600 }
                        : { borderColor: 'rgba(26,58,110,0.6)', backgroundColor: 'transparent', color: '#5a7dc4' }
                      }
                    >
                      No notes — don&apos;t use course material
                    </button>

                    {notesLibrary.map((set) => (
                      <button
                        key={set.id}
                        onClick={() => setSelectedNotesId(set.id)}
                        className="w-full text-left px-4 py-2.5 rounded-xl border-2 transition-all"
                        style={selectedNotesId === set.id
                          ? { borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.15)' }
                          : { borderColor: 'rgba(26,58,110,0.6)', backgroundColor: 'transparent' }
                        }
                      >
                        <div
                          className="font-semibold text-sm"
                          style={{ color: selectedNotesId === set.id ? '#b8a4ff' : '#94afee' }}
                        >
                          {set.label}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: '#2d5299' }}>
                          {set.pdfNames.length > 0
                            ? set.pdfNames.join(', ')
                            : new Date(set.savedAt).toLocaleDateString()}
                        </div>
                      </button>
                    ))}
                  </div>

                  {selectedNotesId && (
                    <p className="mt-3 text-xs" style={{ color: '#5a7dc4' }}>
                      ✓ Claude will weave relevant chapter concepts into your post naturally.
                    </p>
                  )}
                </div>
              )}

              {/* Options */}
              <div className="rounded-2xl p-6" style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}>
                <h3 className="font-bold mb-4" style={{ color: '#e0e9ff' }}>Options</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: '#94afee' }}>Course / Subject</label>
                    <input
                      type="text"
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      placeholder="e.g. Marketing 301, Intro to Psychology"
                      className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                      style={{
                        backgroundColor: 'rgba(7,14,33,0.8)',
                        border: '1px solid rgba(26,58,110,0.8)',
                        color: '#e0e9ff',
                        '--tw-ring-color': '#7c3aed',
                      } as React.CSSProperties}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1" style={{ color: '#94afee' }}>
                      Word count requirement
                    </label>
                    <p className="text-xs mb-2" style={{ color: '#2d5299' }}>Set to match your professor's requirement.</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-xs mb-1" style={{ color: '#5a7dc4' }}>Min words</label>
                        <input
                          type="number"
                          min={25}
                          max={2000}
                          value={minWords}
                          onChange={(e) => {
                            const v = Math.max(25, parseInt(e.target.value) || 25)
                            setMinWords(v)
                            handleWordCountChange('min', v)
                          }}
                          className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                          style={{
                            backgroundColor: 'rgba(7,14,33,0.8)',
                            border: '1px solid rgba(26,58,110,0.8)',
                            color: '#e0e9ff',
                            '--tw-ring-color': '#7c3aed',
                          } as React.CSSProperties}
                        />
                      </div>
                      <span className="text-sm mt-4" style={{ color: '#2d5299' }}>–</span>
                      <div className="flex-1">
                        <label className="block text-xs mb-1" style={{ color: '#5a7dc4' }}>Max words</label>
                        <input
                          type="number"
                          min={25}
                          max={2000}
                          value={maxWords}
                          onChange={(e) => {
                            const v = Math.max(minWords, parseInt(e.target.value) || minWords)
                            setMaxWords(v)
                            handleWordCountChange('max', v)
                          }}
                          className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                          style={{
                            backgroundColor: 'rgba(7,14,33,0.8)',
                            border: '1px solid rgba(26,58,110,0.8)',
                            color: '#e0e9ff',
                            '--tw-ring-color': '#7c3aed',
                          } as React.CSSProperties}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1" style={{ color: '#94afee' }}>
                      Professor&apos;s criteria <span className="font-normal text-sm" style={{ color: '#2d5299' }}>(optional)</span>
                    </label>
                    <p className="text-xs mb-2" style={{ color: '#2d5299' }}>Paste any rubric requirements or grading criteria.</p>
                    <textarea
                      value={professorCriteria}
                      onChange={(e) => setProfessorCriteria(e.target.value)}
                      onBlur={(e) => {
                        if (e.target.value.trim().length > 10) {
                          track({
                            event_name: 'criteria_added',
                            event_data: { char_count: e.target.value.length, post_type: postType },
                          })
                        }
                      }}
                      placeholder="e.g. Responses must be substantive, reference at least one course concept, and include a question for the classmate..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 transition-all"
                      style={{
                        backgroundColor: 'rgba(7,14,33,0.8)',
                        border: '1px solid rgba(26,58,110,0.8)',
                        color: '#e0e9ff',
                        '--tw-ring-color': '#7c3aed',
                      } as React.CSSProperties}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: '#94afee' }}>Tone</label>
                    <div className="flex gap-2 flex-wrap">
                      {TONES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setTone(t.id)
                            track({
                              event_name: 'tone_selected',
                              event_data: { tone: t.id, post_type: postType, is_non_default: t.id !== 'thoughtful' },
                            })
                          }}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
                          style={tone === t.id
                            ? { backgroundColor: '#7c3aed', color: '#fff', borderColor: '#7c3aed' }
                            : { borderColor: 'rgba(26,58,110,0.8)', color: '#5a7dc4', backgroundColor: 'transparent' }
                          }
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                variant="gradient"
                size="lg"
                className="w-full gap-2"
                onClick={handleGenerate}
                disabled={!prompt.trim() || loading}
                style={{ boxShadow: '0 0 24px rgba(124,58,237,0.35)' }}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Racing the clock…
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Draft it
                  </>
                )}
              </Button>
            </div>

            {/* Output panel */}
            <div>
              <div
                className="rounded-2xl p-6 sticky top-8"
                style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold" style={{ color: '#e0e9ff' }}>Your draft</h3>
                    {wordCount !== null && (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={wordCountInRange
                          ? { backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ade80' }
                          : { backgroundColor: 'rgba(251,191,36,0.15)', color: '#fbbf24' }
                        }
                      >
                        {wordCount}w {wordCountInRange ? '✓' : `(target: ${wordTarget})`}
                      </span>
                    )}
                    {styleEnabled && styleFingerprint && result && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'rgba(124,58,237,0.15)', color: '#9775fa' }}
                      >
                        ✨ your style
                      </span>
                    )}
                    {generationCtx?.hadCourseNotes && result && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#34d399' }}
                      >
                        📚 course notes
                      </span>
                    )}
                    {generationCtx?.hadPdf && result && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}
                      >
                        📎 PDF
                      </span>
                    )}
                  </div>
                  {result && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setResult(''); setWordCount(null); setGenerationCtx(null); setThumbed(false) }}
                        className="gap-1 text-xs"
                        style={{ color: '#5a7dc4' }}
                      >
                        <RotateCcw className="w-3 h-3" /> Reset
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        className="gap-1 text-xs"
                        style={{ borderColor: 'rgba(124,58,237,0.4)', color: '#9775fa' }}
                      >
                        {copied ? <CheckCheck className="w-3 h-3" style={{ color: '#4ade80' }} /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                  )}
                </div>

                {result ? (
                  <>
                    <div className="rounded-xl p-4 min-h-64" style={{ backgroundColor: 'rgba(7,14,33,0.6)' }}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#c4d4ff' }}>{result}</p>
                    </div>

                    {/* Quality feedback + IP confirmation strip */}
                    <div
                      className="mt-3 flex items-center justify-between px-3 py-2 rounded-xl"
                      style={{ backgroundColor: 'rgba(7,14,33,0.4)', border: '1px solid rgba(26,58,110,0.4)' }}
                    >
                      <span className="text-xs" style={{ color: '#2d5299' }}>
                        ✓ 2-pass humanization · burstiness + perplexity optimized
                      </span>
                      <button
                        onClick={handleThumbsUp}
                        disabled={thumbed}
                        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
                        style={thumbed
                          ? { backgroundColor: 'rgba(74,222,128,0.12)', color: '#4ade80', cursor: 'default' }
                          : { backgroundColor: 'rgba(26,58,110,0.4)', color: '#5a7dc4' }
                        }
                      >
                        <ThumbsUp className="w-3 h-3" />
                        {thumbed ? 'Thanks!' : 'Looks great'}
                      </button>
                    </div>

                    {/* Refinement section */}
                    <div className="mt-2">
                      <button
                        onClick={() => setRefineExpanded(!refineExpanded)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:bg-white/5"
                        style={{
                          backgroundColor: refineExpanded ? 'rgba(124,58,237,0.1)' : 'rgba(26,58,110,0.15)',
                          border: `1px solid ${refineExpanded ? 'rgba(124,58,237,0.35)' : 'rgba(26,58,110,0.4)'}`,
                          color: refineExpanded ? '#9775fa' : '#5a7dc4',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Refine this post</span>
                          <span className="text-xs font-normal" style={{ color: refineExpanded ? '#7c6dc4' : '#2d5299' }}>
                            — tell us what&apos;s missing
                          </span>
                        </div>
                        {refineExpanded
                          ? <ChevronUp className="w-4 h-4" />
                          : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {refineExpanded && (
                        <div
                          className="mt-1 rounded-xl overflow-hidden"
                          style={{ border: '1px solid rgba(124,58,237,0.25)', backgroundColor: 'rgba(7,14,33,0.4)' }}
                        >
                          <div className="p-3 space-y-2">
                            <p className="text-xs" style={{ color: '#5a7dc4' }}>
                              Describe exactly what to change — everything else stays intact.
                            </p>
                            <textarea
                              value={refineFeedback}
                              onChange={(e) => setRefineFeedback(e.target.value)}
                              placeholder="e.g. 'Add a specific real-world example' or 'Make the ending sound less formal' or 'Include a question for the class'"
                              rows={3}
                              className="w-full px-3 py-2.5 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 transition-all"
                              style={{
                                backgroundColor: 'rgba(7,14,33,0.8)',
                                border: '1px solid rgba(26,58,110,0.8)',
                                color: '#e0e9ff',
                                '--tw-ring-color': '#7c3aed',
                              } as React.CSSProperties}
                            />
                            <Button
                              variant="gradient"
                              size="sm"
                              className="w-full gap-2"
                              onClick={handleRefine}
                              disabled={!refineFeedback.trim() || refining}
                            >
                              {refining ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Refining…</>
                              ) : (
                                <><Pencil className="w-3.5 h-3.5" /> Refine post</>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div
                    className="rounded-xl p-8 min-h-64 flex flex-col items-center justify-center text-center"
                    style={{ backgroundColor: 'rgba(7,14,33,0.6)' }}
                  >
                    {loading ? (
                      <div className="space-y-3">
                        <div
                          className="w-8 h-8 border-2 rounded-full animate-spin mx-auto"
                          style={{ borderColor: 'rgba(124,58,237,0.3)', borderTopColor: '#7c3aed' }}
                        />
                        <p className="text-sm" style={{ color: '#5a7dc4' }}>Racing the clock…</p>
                      </div>
                    ) : (
                      <>
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                          style={{ backgroundColor: 'rgba(124,58,237,0.15)' }}
                        >
                          <FileText className="w-6 h-6" style={{ color: '#7c3aed' }} />
                        </div>
                        <p className="text-sm font-semibold mb-1" style={{ color: '#94afee' }}>Your post will appear here</p>
                        <p className="text-xs" style={{ color: '#2d5299' }}>Fill in the prompt and hit &quot;Draft it&quot;</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

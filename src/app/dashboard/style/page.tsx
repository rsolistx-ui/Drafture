'use client'

/**
 * DMD-016/017/018 — Style matching management page.
 *
 * Users paste 1–3 of their own discussion posts, hit Analyze, and get a
 * StyleFingerprint stored in localStorage. When enabled, this fingerprint is
 * passed to /api/generate so the output sounds like them, not like AI.
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, Trash2, Plus, X, CheckCircle, ToggleLeft, ToggleRight } from 'lucide-react'
import DashboardSidebar from '@/components/DashboardSidebar'
import type { StyleFingerprint } from '@/lib/style/types'
import { STYLE_STORAGE_KEY, MIN_SAMPLE_CHARS } from '@/lib/style/types'

const STYLE_ENABLED_KEY = 'drafture_style_enabled_v1'

const RHYTHM_LABELS: Record<string, string> = {
  short_punchy:     'Short & punchy',
  medium_balanced:  'Medium balanced',
  long_flowing:     'Long & flowing',
  highly_variable:  'Highly variable',
}

const REGISTER_LABELS: Record<string, string> = {
  casual:   'Casual',
  mixed:    'Mixed casual/academic',
  academic: 'Academic',
}

export default function StylePage() {
  const [fingerprint, setFingerprint] = useState<StyleFingerprint | null>(null)
  const [styleEnabled, setStyleEnabled] = useState(true)
  const [samples, setSamples] = useState<string[]>(['', '', ''])
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem(STYLE_STORAGE_KEY)
        if (stored) setFingerprint(JSON.parse(stored))

        const enabled = localStorage.getItem(STYLE_ENABLED_KEY)
        // Default to enabled if fingerprint exists and no explicit disable
        setStyleEnabled(enabled !== 'false')
      } catch {
        // localStorage unavailable
      }
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  const handleToggle = () => {
    const next = !styleEnabled
    setStyleEnabled(next)
    localStorage.setItem(STYLE_ENABLED_KEY, next ? 'true' : 'false')
  }

  const handleAnalyze = async () => {
    const validSamples = samples.filter((s) => s.trim().length >= MIN_SAMPLE_CHARS)
    if (validSamples.length === 0) {
      setError(`Paste at least one writing sample (${MIN_SAMPLE_CHARS}+ characters each).`)
      return
    }

    setAnalyzing(true)
    setError('')
    setJustSaved(false)

    try {
      const res = await fetch('/api/style/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ samples: validSamples }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Analysis failed. Please try again.')
        return
      }

      const fp: StyleFingerprint = data.fingerprint
      setFingerprint(fp)
      localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(fp))
      localStorage.setItem(STYLE_ENABLED_KEY, 'true')
      setStyleEnabled(true)
      setJustSaved(true)
      // Clear samples after successful extraction
      setSamples(['', '', ''])
      setTimeout(() => setJustSaved(false), 4000)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleClear = () => {
    setFingerprint(null)
    setStyleEnabled(true)
    localStorage.removeItem(STYLE_STORAGE_KEY)
    localStorage.removeItem(STYLE_ENABLED_KEY)
  }

  const validSampleCount = samples.filter((s) => s.trim().length >= MIN_SAMPLE_CHARS).length

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#070e21' }}>
      <DashboardSidebar />

      <div className="ml-64 p-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'rgba(124,58,237,0.2)' }}
              >
                <Sparkles className="w-5 h-5" style={{ color: '#9775fa' }} />
              </div>
              <h1 className="text-3xl font-extrabold" style={{ color: '#e0e9ff' }}>My Style</h1>
            </div>
            <p style={{ color: '#5a7dc4' }}>
              Teach Drafture your writing voice. Once set, every post will sound like{' '}
              <em>you</em> — not like everyone else using the same AI.
            </p>
          </div>

          {/* Active fingerprint */}
          {fingerprint && (
            <div
              className="rounded-2xl p-6 mb-8"
              style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(124,58,237,0.35)' }}
            >
              {/* Header row */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4" style={{ color: '#4ade80' }} />
                    <span className="font-bold text-sm" style={{ color: '#4ade80' }}>
                      Style fingerprint captured
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: '#5a7dc4' }}>
                    Analyzed {fingerprint.sample_count} sample{fingerprint.sample_count !== 1 ? 's' : ''} ·{' '}
                    {new Date(fingerprint.extracted_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                </div>

                {/* Enable/disable toggle */}
                <button
                  onClick={handleToggle}
                  className="flex items-center gap-2 text-sm font-semibold transition-colors"
                  style={{ color: styleEnabled ? '#9775fa' : '#5a7dc4' }}
                >
                  {styleEnabled
                    ? <ToggleRight className="w-6 h-6" style={{ color: '#7c3aed' }} />
                    : <ToggleLeft className="w-6 h-6" />
                  }
                  {styleEnabled ? 'Active' : 'Paused'}
                </button>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                  { label: 'Sentence rhythm',   value: RHYTHM_LABELS[fingerprint.sentence_rhythm] ?? fingerprint.sentence_rhythm },
                  { label: 'Vocabulary',         value: REGISTER_LABELS[fingerprint.vocabulary_register] ?? fingerprint.vocabulary_register },
                  { label: 'Avg sentence',       value: `~${fingerprint.avg_sentence_length} words` },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl p-3 text-center"
                    style={{ backgroundColor: 'rgba(7,14,33,0.6)' }}
                  >
                    <div className="text-xs mb-1" style={{ color: '#5a7dc4' }}>{label}</div>
                    <div className="text-sm font-semibold" style={{ color: '#c4d4ff' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Tone notes */}
              <div
                className="rounded-xl p-4 mb-4"
                style={{ backgroundColor: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}
              >
                <div className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#9775fa' }}>
                  Your voice, in a sentence
                </div>
                <p className="text-sm leading-relaxed italic" style={{ color: '#c4d4ff' }}>
                  &ldquo;{fingerprint.tone_notes}&rdquo;
                </p>
              </div>

              {/* Signature phrases */}
              {fingerprint.sample_phrases.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#5a7dc4' }}>
                    Signature phrases
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {fingerprint.sample_phrases.map((phrase, i) => (
                      <span
                        key={i}
                        className="text-xs px-2.5 py-1 rounded-lg"
                        style={{ backgroundColor: 'rgba(26,58,110,0.6)', color: '#94afee' }}
                      >
                        &ldquo;{phrase}&rdquo;
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Voice markers */}
              {fingerprint.voice_markers.length > 0 && (
                <div>
                  <div className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#5a7dc4' }}>
                    Voice markers
                  </div>
                  <ul className="space-y-1">
                    {fingerprint.voice_markers.map((marker, i) => (
                      <li key={i} className="flex gap-2 text-xs" style={{ color: '#94afee' }}>
                        <span style={{ color: '#5a7dc4' }}>—</span>
                        {marker}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Clear button */}
              <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(26,58,110,0.5)' }}>
                <button
                  onClick={handleClear}
                  className="flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
                  style={{ color: '#5a7dc4' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear style data and start over
                </button>
              </div>
            </div>
          )}

          {/* Success flash */}
          {justSaved && (
            <div
              className="rounded-xl px-4 py-3 mb-6 flex items-center gap-2 text-sm font-semibold"
              style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}
            >
              <CheckCircle className="w-4 h-4" />
              Style fingerprint saved! Your next post will reflect your voice.
            </div>
          )}

          {/* Input section */}
          <div
            className="rounded-2xl p-6"
            style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}
          >
            <h2 className="font-bold mb-1" style={{ color: '#e0e9ff' }}>
              {fingerprint ? 'Update your style' : 'Set up your style'}
            </h2>
            <p className="text-sm mb-6" style={{ color: '#5a7dc4' }}>
              Paste 1–3 discussion posts you&apos;ve written before — graded ones work best.
              The more you paste, the better the fingerprint.
            </p>

            <div className="space-y-4">
              {samples.map((sample, idx) => {
                const charCount = sample.trim().length
                const isValid = charCount >= MIN_SAMPLE_CHARS
                const isEmpty = charCount === 0

                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        className="text-sm font-semibold"
                        style={{ color: '#94afee' }}
                      >
                        Writing sample {idx + 1}
                        {idx > 0 && (
                          <span className="font-normal ml-1" style={{ color: '#2d5299' }}>
                            (optional)
                          </span>
                        )}
                      </label>
                      <div className="flex items-center gap-2">
                        {!isEmpty && (
                          <span
                            className="text-xs"
                            style={{ color: isValid ? '#4ade80' : '#fbbf24' }}
                          >
                            {charCount} chars{!isValid && ` (need ${MIN_SAMPLE_CHARS - charCount} more)`}
                          </span>
                        )}
                        {!isEmpty && (
                          <button
                            onClick={() => {
                              const next = [...samples]
                              next[idx] = ''
                              setSamples(next)
                            }}
                            style={{ color: '#5a7dc4' }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <textarea
                      value={sample}
                      onChange={(e) => {
                        const next = [...samples]
                        next[idx] = e.target.value
                        setSamples(next)
                        setError('')
                      }}
                      placeholder={
                        idx === 0
                          ? 'Paste a discussion post you wrote. Any subject, any length — just something graded...'
                          : 'Another discussion post (optional but improves accuracy)...'
                      }
                      rows={idx === 0 ? 7 : 5}
                      className="w-full px-4 py-3 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 transition-all"
                      style={{
                        backgroundColor: 'rgba(7,14,33,0.8)',
                        border: `1px solid ${isValid ? 'rgba(74,222,128,0.3)' : 'rgba(26,58,110,0.8)'}`,
                        color: '#e0e9ff',
                        '--tw-ring-color': '#7c3aed',
                      } as React.CSSProperties}
                    />
                  </div>
                )
              })}
            </div>

            {samples.length < 3 && (
              <button
                onClick={() => setSamples([...samples, ''])}
                className="flex items-center gap-1.5 text-xs mt-3 transition-colors hover:opacity-80"
                style={{ color: '#5a7dc4' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add another sample
              </button>
            )}

            {error && (
              <p className="text-xs mt-4" style={{ color: '#ef4444' }}>{error}</p>
            )}

            <div className="flex items-center gap-3 mt-6">
              <Button
                variant="gradient"
                onClick={handleAnalyze}
                disabled={analyzing || validSampleCount === 0}
                className="gap-2"
                style={{ boxShadow: '0 0 20px rgba(124,58,237,0.3)' }}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing your writing…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {fingerprint ? 'Re-analyze my style' : 'Analyze my writing style'}
                  </>
                )}
              </Button>
              {validSampleCount > 0 && !analyzing && (
                <span className="text-xs" style={{ color: '#5a7dc4' }}>
                  {validSampleCount} valid sample{validSampleCount !== 1 ? 's' : ''} ready
                </span>
              )}
            </div>

            <p className="text-xs mt-3" style={{ color: '#2d5299' }}>
              Your samples are sent to Claude for one-time analysis and are not stored on our servers.
              Only the extracted style fingerprint is saved, in your browser.
            </p>
          </div>

          {/* How it works */}
          <div
            className="rounded-2xl p-6 mt-6"
            style={{ backgroundColor: 'rgba(12,28,61,0.5)', border: '1px solid rgba(26,58,110,0.4)' }}
          >
            <h3 className="font-bold mb-3 text-sm" style={{ color: '#94afee' }}>How style matching works</h3>
            <div className="space-y-2">
              {[
                ['📝', 'We analyze your sentence rhythm, vocabulary, phrasing habits, and tone markers'],
                ['🎯', 'Every generated post is calibrated to reflect those patterns, not generic AI prose'],
                ['🔄', 'Paste new samples any time to update — your style naturally evolves over a semester'],
                ['🔒', 'The fingerprint lives in your browser — nothing is saved to any database'],
              ].map(([icon, text]) => (
                <div key={text as string} className="flex gap-3 text-sm" style={{ color: '#5a7dc4' }}>
                  <span>{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

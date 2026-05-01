'use client'

/**
 * Admin — IP Self-Improvement Dashboard
 *
 * Triggers a Claude Opus 4.7 analysis of the humanization prompts against
 * current performance data and returns specific improvement suggestions.
 *
 * Access: /admin/prompt-improve?secret=<ADMIN_SECRET>
 *
 * This is the "supervised self-improvement" model:
 *   Claude identifies what to improve → human reviews → developer applies → prompt version bumps.
 *   The IP gets sharper with each cycle without autonomous code changes.
 */

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, Zap, AlertCircle, ChevronDown, ChevronUp, ArrowUpCircle } from 'lucide-react'

interface Suggestion {
  area: string
  current_behavior: string
  suggested_change: string
  rationale: string
  priority: 'high' | 'medium' | 'low'
}

interface Metric {
  prompt_version: string
  total_generated: number
  total_copied: number
  total_thumbs_up: number
  copy_rate: number
  thumbs_rate: number
}

interface AnalysisResult {
  prompt_version: string
  metrics: Metric[]
  suggestions: Suggestion[]
  overall_assessment: string
  next_version_recommendation: string
  analysis_timestamp: string
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  high:   { bg: 'rgba(239,68,68,0.1)',   text: '#f87171', label: '🔴 High' },
  medium: { bg: 'rgba(251,191,36,0.1)',  text: '#fbbf24', label: '🟡 Medium' },
  low:    { bg: 'rgba(74,222,128,0.1)',  text: '#4ade80', label: '🟢 Low' },
}

export default function PromptImprovePage() {
  const searchParams = useSearchParams()
  const secret = searchParams.get('secret') ?? ''

  const [focusArea, setFocusArea] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  // Gate check
  const [authorized, setAuthorized] = useState(false)
  useEffect(() => {
    // We can't verify ADMIN_SECRET client-side — the API call will gate it.
    // Just check that a secret was provided so the page isn't blank on load.
    setAuthorized(!!secret)
  }, [secret])

  const handleAnalyze = async () => {
    setLoading(true)
    setResult(null)
    setError('')

    try {
      const res = await fetch('/api/admin/prompt-improve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secret,
        },
        body: JSON.stringify({ focusArea: focusArea.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Analysis failed.')
        return
      }
      setResult(data as AnalysisResult)
    } catch {
      setError('Request failed. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#070e21' }}>
        <p style={{ color: '#5a7dc4' }}>Access requires <code>?secret=...</code> in the URL.</p>
      </div>
    )
  }

  const highPriority   = result?.suggestions.filter(s => s.priority === 'high')   ?? []
  const mediumPriority = result?.suggestions.filter(s => s.priority === 'medium') ?? []
  const lowPriority    = result?.suggestions.filter(s => s.priority === 'low')    ?? []

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#070e21' }}>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'rgba(124,58,237,0.15)' }}
            >
              <ArrowUpCircle className="w-5 h-5" style={{ color: '#9775fa' }} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold" style={{ color: '#e0e9ff' }}>IP Improvement Engine</h1>
              <p className="text-sm" style={{ color: '#5a7dc4' }}>
                Claude Opus 4.7 analyzes the humanization prompts and surfaces specific improvements.
              </p>
            </div>
          </div>

          <div
            className="mt-4 rounded-xl px-4 py-3 text-sm"
            style={{ backgroundColor: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: '#9775fa' }}
          >
            <strong>How this works:</strong> Claude reviews the current prompts against performance metrics
            and identifies patterns that AI detectors could flag. You review the suggestions, apply the
            ones that make sense, and bump the prompt version. The IP improves with every cycle.
          </div>
        </div>

        {/* Controls */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}
        >
          <h3 className="font-bold mb-1" style={{ color: '#e0e9ff' }}>Focus area <span className="font-normal text-sm" style={{ color: '#2d5299' }}>(optional)</span></h3>
          <p className="text-sm mb-3" style={{ color: '#5a7dc4' }}>
            Describe a specific concern to focus the analysis on. Leave blank for a full review.
          </p>
          <input
            type="text"
            value={focusArea}
            onChange={(e) => setFocusArea(e.target.value)}
            placeholder="e.g. 'Turnitin flagging rate seems high' or 'instructor reply tone feels too formal'"
            className="w-full px-4 py-2.5 rounded-xl text-sm mb-4 focus:outline-none focus:ring-2 transition-all"
            style={{
              backgroundColor: 'rgba(7,14,33,0.8)',
              border: '1px solid rgba(26,58,110,0.8)',
              color: '#e0e9ff',
              '--tw-ring-color': '#7c3aed',
            } as React.CSSProperties}
          />

          <Button
            variant="gradient"
            onClick={handleAnalyze}
            disabled={loading}
            className="gap-2"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing with Opus 4.7 + adaptive thinking…</>
              : <><Zap className="w-4 h-4" /> Run improvement analysis</>}
          </Button>
          {loading && (
            <p className="mt-2 text-xs" style={{ color: '#2d5299' }}>
              This uses adaptive thinking — allow 20–60 seconds for a thorough analysis.
            </p>
          )}
        </div>

        {error && (
          <div
            className="rounded-xl px-4 py-3 mb-6 flex items-center gap-2 text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-6">

            {/* Summary */}
            <div
              className="rounded-2xl p-6"
              style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold" style={{ color: '#e0e9ff' }}>Analysis summary</h3>
                <span className="text-xs" style={{ color: '#2d5299' }}>
                  {new Date(result.analysis_timestamp).toLocaleString()} · v{result.prompt_version}
                </span>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#c4d4ff' }}>
                {result.overall_assessment}
              </p>
              <div
                className="rounded-xl px-4 py-3 text-sm"
                style={{ backgroundColor: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', color: '#b8a4ff' }}
              >
                <strong>Recommended next version:</strong> {result.next_version_recommendation}
              </div>

              {/* Metrics */}
              {result.metrics.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {result.metrics.slice(0, 1).flatMap(m => [
                    { label: 'Generated (30d)', value: m.total_generated.toLocaleString() },
                    { label: 'Copy rate', value: `${(m.copy_rate * 100).toFixed(1)}%` },
                    { label: '👍 Rate', value: `${(m.thumbs_rate * 100).toFixed(1)}%` },
                  ]).map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-xl p-3 text-center"
                      style={{ backgroundColor: 'rgba(7,14,33,0.6)' }}
                    >
                      <p className="text-lg font-bold" style={{ color: '#e0e9ff' }}>{value}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#5a7dc4' }}>{label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Suggestions by priority */}
            {[
              { items: highPriority,   label: 'High priority — fix next version' },
              { items: mediumPriority, label: 'Medium priority — consider soon' },
              { items: lowPriority,    label: 'Low priority — polish items' },
            ].filter(g => g.items.length > 0).map(({ items, label }) => (
              <div
                key={label}
                className="rounded-2xl p-6"
                style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}
              >
                <h3 className="font-bold mb-4" style={{ color: '#e0e9ff' }}>
                  {label}{' '}
                  <span
                    className="text-xs font-normal px-2 py-0.5 rounded-full ml-1"
                    style={{ backgroundColor: 'rgba(26,58,110,0.6)', color: '#5a7dc4' }}
                  >
                    {items.length}
                  </span>
                </h3>
                <div className="space-y-3">
                  {items.map((s, i) => {
                    const id = `${s.priority}-${i}`
                    const open = expanded === id
                    const colors = PRIORITY_COLORS[s.priority]
                    return (
                      <div
                        key={id}
                        className="rounded-xl overflow-hidden"
                        style={{ border: `1px solid ${colors.bg.replace('0.1', '0.4')}` }}
                      >
                        <button
                          className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                          onClick={() => setExpanded(open ? null : id)}
                        >
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5"
                            style={{ backgroundColor: colors.bg, color: colors.text }}
                          >
                            {colors.label}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold" style={{ color: '#c4d4ff' }}>{s.area}</p>
                            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#5a7dc4' }}>{s.current_behavior}</p>
                          </div>
                          {open
                            ? <ChevronUp className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#5a7dc4' }} />
                            : <ChevronDown className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#5a7dc4' }} />}
                        </button>
                        {open && (
                          <div
                            className="px-4 pb-4 space-y-3"
                            style={{ borderTop: '1px solid rgba(26,58,110,0.4)' }}
                          >
                            <div className="pt-3">
                              <p className="text-xs font-semibold uppercase mb-1" style={{ color: '#5a7dc4' }}>Current behavior</p>
                              <p className="text-sm" style={{ color: '#94afee' }}>{s.current_behavior}</p>
                            </div>
                            <div
                              className="rounded-xl px-4 py-3"
                              style={{ backgroundColor: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}
                            >
                              <p className="text-xs font-semibold uppercase mb-1" style={{ color: '#9775fa' }}>Suggested change</p>
                              <p className="text-sm" style={{ color: '#c4d4ff' }}>{s.suggested_change}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase mb-1" style={{ color: '#5a7dc4' }}>Why this helps</p>
                              <p className="text-sm" style={{ color: '#94afee' }}>{s.rationale}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            <div
              className="rounded-xl px-4 py-3 text-xs"
              style={{ backgroundColor: 'rgba(26,58,110,0.2)', color: '#2d5299' }}
            >
              💡 To apply: update <code>src/lib/humanization/prompts.ts</code>, bump <code>PROMPT_VERSION</code>,
              and redeploy. Run another analysis after 50+ generations to measure the delta in copy and thumbs-up rates.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

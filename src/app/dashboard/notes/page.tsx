'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  BookOpen, Upload, X, Copy, CheckCheck, Loader2,
  RotateCcw, FileText, Save, Trash2, Library,
} from 'lucide-react'
import DashboardSidebar from '@/components/DashboardSidebar'
import {
  listNoteSets,
  addNoteSet,
  removeNoteSet,
  type SavedNoteSet,
} from '@/lib/notes/storage'

interface PdfSlot {
  file: File
  name: string
  base64: string
}

const MAX_PDF_MB = 15
const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function NotesPage() {
  const [slots, setSlots] = useState<(PdfSlot | null)[]>([null, null, null])
  const [course, setCourse] = useState('')
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [fileError, setFileError] = useState('')
  const [saved, setSaved] = useState(false)

  // ── Notes library ────────────────────────────────────────────────────────
  const [library, setLibrary] = useState<SavedNoteSet[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  // Load library from localStorage on mount
  useEffect(() => {
    try {
      setLibrary(listNoteSets())
    } catch { /* localStorage unavailable */ }
  }, [])

  const handleFileSelect = async (index: number, file: File) => {
    setFileError('')
    if (file.type !== 'application/pdf') {
      setFileError('Only PDF files are supported.')
      return
    }
    if (file.size > MAX_PDF_BYTES) {
      setFileError(`"${file.name}" is too large. Maximum size is ${MAX_PDF_MB}MB.`)
      return
    }
    try {
      const base64 = await readFileAsBase64(file)
      const updated = [...slots]
      updated[index] = { file, name: file.name, base64 }
      setSlots(updated)
    } catch {
      setFileError(`Could not read "${file.name}". Please try again.`)
    }
  }

  const handleRemove = (index: number) => {
    const updated = [...slots]
    updated[index] = null
    setSlots(updated)
    if (inputRefs[index].current) inputRefs[index].current!.value = ''
  }

  const handleDrop = (index: number, e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(index, file)
  }

  const activePdfs = slots.filter(Boolean) as PdfSlot[]

  const handleGenerate = async () => {
    if (activePdfs.length === 0) return
    setLoading(true)
    setNotes('')
    setError('')
    setSaved(false)

    try {
      const res = await fetch('/api/notes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfs: activePdfs.map(p => ({ base64: p.base64, name: p.name })),
          course: course.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      setNotes(data.notes || '')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveToLibrary = () => {
    const pdfNames = activePdfs.map(p => p.name)
    const label = course.trim()
      ? course.trim()
      : pdfNames.length > 0
        ? pdfNames[0].replace(/\.pdf$/i, '')
        : 'Course notes'

    try {
      const newSet = addNoteSet({
        label,
        course: course.trim(),
        pdfNames,
        notes,
      })
      setLibrary([newSet, ...library].slice(0, 10))
      setSaved(true)
    } catch { /* storage full — fail silently */ }
  }

  const handleDeleteFromLibrary = (id: string) => {
    try {
      removeNoteSet(id)
      setLibrary(library.filter(s => s.id !== id))
      if (expandedId === id) setExpandedId(null)
    } catch { /* ok */ }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(notes)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#070e21' }}>
      <DashboardSidebar />

      <div className="ml-64 p-8">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'rgba(124,58,237,0.15)' }}
              >
                <BookOpen className="w-5 h-5" style={{ color: '#9775fa' }} />
              </div>
              <h1 className="text-3xl font-extrabold" style={{ color: '#e0e9ff' }}>
                Course notes
              </h1>
            </div>
            <p style={{ color: '#5a7dc4' }}>
              Upload your professor&apos;s PDFs and get structured, exam-ready academic notes.
              Save them to your library and Drafture will use them when drafting your posts.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* ── Input panel ───────────────────────────────────────────── */}
            <div className="space-y-6">

              {/* PDF Upload slots */}
              <div
                className="rounded-2xl p-6"
                style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}
              >
                <h3 className="font-bold mb-1" style={{ color: '#e0e9ff' }}>Upload PDFs</h3>
                <p className="text-sm mb-4" style={{ color: '#5a7dc4' }}>
                  Upload up to 3 PDFs (readings, lecture slides, notes). Max {MAX_PDF_MB}MB each.
                </p>

                <div className="space-y-3">
                  {slots.map((slot, i) => (
                    <div key={i}>
                      {slot ? (
                        <div
                          className="flex items-center gap-3 px-4 py-3 rounded-xl"
                          style={{
                            backgroundColor: 'rgba(124,58,237,0.1)',
                            border: '1px solid rgba(124,58,237,0.3)',
                          }}
                        >
                          <FileText className="w-4 h-4 shrink-0" style={{ color: '#9775fa' }} />
                          <span
                            className="text-sm font-medium flex-1 truncate"
                            style={{ color: '#c4d4ff' }}
                          >
                            {slot.name}
                          </span>
                          <span className="text-xs shrink-0" style={{ color: '#5a7dc4' }}>
                            {(slot.file.size / 1024 / 1024).toFixed(1)}MB
                          </span>
                          <button
                            onClick={() => handleRemove(i)}
                            className="shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
                            style={{ color: '#5a7dc4' }}
                            aria-label="Remove PDF"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label
                          className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl cursor-pointer transition-colors hover:border-violet-500/50"
                          style={{
                            border: '2px dashed rgba(26,58,110,0.8)',
                            backgroundColor: 'rgba(7,14,33,0.4)',
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleDrop(i, e)}
                        >
                          <Upload className="w-5 h-5" style={{ color: '#5a7dc4' }} />
                          <span className="text-sm font-semibold" style={{ color: '#94afee' }}>
                            PDF {i + 1}{i > 0 ? ' (optional)' : ''}
                          </span>
                          <span className="text-xs" style={{ color: '#2d5299' }}>
                            Click or drag &amp; drop
                          </span>
                          <input
                            ref={inputRefs[i]}
                            type="file"
                            accept="application/pdf"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleFileSelect(i, file)
                            }}
                          />
                        </label>
                      )}
                    </div>
                  ))}
                </div>

                {fileError && (
                  <p className="mt-3 text-xs" style={{ color: '#ef4444' }}>{fileError}</p>
                )}
              </div>

              {/* Course input */}
              <div
                className="rounded-2xl p-6"
                style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}
              >
                <label className="block text-sm font-semibold mb-1" style={{ color: '#94afee' }}>
                  Course / Subject{' '}
                  <span className="font-normal" style={{ color: '#2d5299' }}>(optional)</span>
                </label>
                <p className="text-xs mb-3" style={{ color: '#2d5299' }}>
                  Used to name the saved note set and help Claude frame context.
                </p>
                <input
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="e.g. Intro to Psychology, Organizational Behavior 410"
                  className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                  style={{
                    backgroundColor: 'rgba(7,14,33,0.8)',
                    border: '1px solid rgba(26,58,110,0.8)',
                    color: '#e0e9ff',
                    '--tw-ring-color': '#7c3aed',
                  } as React.CSSProperties}
                />
              </div>

              {/* What you get */}
              <div
                className="rounded-2xl p-6"
                style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}
              >
                <h3 className="font-bold mb-3" style={{ color: '#e0e9ff' }}>What you&apos;ll get</h3>
                <ul className="space-y-2">
                  {[
                    { icon: '📌', text: 'Exam-flagged items — definitions, frameworks, key facts' },
                    { icon: '🎯', text: 'Discussion prompts and application scenarios' },
                    { icon: '🔑', text: 'Bold key terms on first use' },
                    { icon: '📋', text: 'Organized by the document\'s own structure' },
                    { icon: '💬', text: 'Saved notes get woven into your discussion posts automatically' },
                  ].map(({ icon, text }) => (
                    <li key={text} className="flex items-start gap-2 text-sm" style={{ color: '#94afee' }}>
                      <span className="shrink-0 mt-0.5">{icon}</span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                variant="gradient"
                size="lg"
                className="w-full gap-2"
                onClick={handleGenerate}
                disabled={activePdfs.length === 0 || loading}
                style={{ boxShadow: '0 0 24px rgba(124,58,237,0.35)' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating notes…
                  </>
                ) : (
                  <>
                    <BookOpen className="w-5 h-5" />
                    Generate notes
                  </>
                )}
              </Button>
            </div>

            {/* ── Output panel ──────────────────────────────────────────── */}
            <div className="space-y-6">

              {/* Generated notes */}
              <div
                className="rounded-2xl p-6"
                style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold" style={{ color: '#e0e9ff' }}>Your notes</h3>
                  {notes && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setNotes(''); setSaved(false) }}
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
                        {copied
                          ? <CheckCheck className="w-3 h-3" style={{ color: '#4ade80' }} />
                          : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                  )}
                </div>

                {error && (
                  <div
                    className="rounded-xl px-4 py-3 mb-4 text-sm"
                    style={{
                      backgroundColor: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: '#f87171',
                    }}
                  >
                    {error}
                  </div>
                )}

                {notes ? (
                  <>
                    <div
                      className="rounded-xl p-4 overflow-y-auto mb-4"
                      style={{
                        backgroundColor: 'rgba(7,14,33,0.6)',
                        maxHeight: '400px',
                        minHeight: '200px',
                      }}
                    >
                      <pre
                        className="text-sm leading-relaxed whitespace-pre-wrap font-sans"
                        style={{ color: '#c4d4ff' }}
                      >
                        {notes}
                      </pre>
                    </div>

                    {/* Save to library */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={handleSaveToLibrary}
                      disabled={saved}
                      style={
                        saved
                          ? { borderColor: 'rgba(74,222,128,0.4)', color: '#4ade80' }
                          : { borderColor: 'rgba(124,58,237,0.4)', color: '#9775fa' }
                      }
                    >
                      {saved
                        ? <><CheckCheck className="w-4 h-4" /> Saved to library</>
                        : <><Save className="w-4 h-4" /> Save to library</>}
                    </Button>
                    {saved && (
                      <p className="mt-2 text-xs text-center" style={{ color: '#5a7dc4' }}>
                        These notes will be available on the generate page to include as course context.
                      </p>
                    )}
                  </>
                ) : (
                  <div
                    className="rounded-xl p-8 flex flex-col items-center justify-center text-center"
                    style={{ backgroundColor: 'rgba(7,14,33,0.6)', minHeight: '200px' }}
                  >
                    {loading ? (
                      <div className="space-y-3">
                        <div
                          className="w-8 h-8 border-2 rounded-full animate-spin mx-auto"
                          style={{ borderColor: 'rgba(124,58,237,0.3)', borderTopColor: '#7c3aed' }}
                        />
                        <p className="text-sm" style={{ color: '#5a7dc4' }}>Reading your PDFs…</p>
                        <p className="text-xs" style={{ color: '#2d5299' }}>
                          This can take 15–30 seconds for large documents.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                          style={{ backgroundColor: 'rgba(124,58,237,0.15)' }}
                        >
                          <BookOpen className="w-6 h-6" style={{ color: '#7c3aed' }} />
                        </div>
                        <p className="text-sm font-semibold mb-1" style={{ color: '#94afee' }}>
                          Your notes will appear here
                        </p>
                        <p className="text-xs" style={{ color: '#2d5299' }}>
                          Upload a PDF and hit &quot;Generate notes&quot;
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* ── Saved notes library ──────────────────────────────────── */}
              {library.length > 0 && (
                <div
                  className="rounded-2xl p-6"
                  style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Library className="w-4 h-4" style={{ color: '#9775fa' }} />
                    <h3 className="font-bold" style={{ color: '#e0e9ff' }}>Saved library</h3>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full ml-auto"
                      style={{ backgroundColor: 'rgba(124,58,237,0.2)', color: '#9775fa' }}
                    >
                      {library.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {library.map((set) => (
                      <div
                        key={set.id}
                        className="rounded-xl overflow-hidden"
                        style={{ border: '1px solid rgba(26,58,110,0.6)' }}
                      >
                        {/* Row header */}
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                          onClick={() => setExpandedId(expandedId === set.id ? null : set.id)}
                        >
                          <FileText className="w-4 h-4 shrink-0" style={{ color: '#5a7dc4' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: '#c4d4ff' }}>
                              {set.label}
                            </p>
                            <p className="text-xs" style={{ color: '#2d5299' }}>
                              {formatDate(set.savedAt)}
                              {set.pdfNames.length > 0 && ` · ${set.pdfNames.length} PDF${set.pdfNames.length > 1 ? 's' : ''}`}
                            </p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteFromLibrary(set.id) }}
                            className="shrink-0 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                            style={{ color: '#2d5299' }}
                            aria-label="Delete note set"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Expanded preview */}
                        {expandedId === set.id && (
                          <div
                            className="px-4 pb-4 pt-2"
                            style={{ borderTop: '1px solid rgba(26,58,110,0.4)' }}
                          >
                            <pre
                              className="text-xs leading-relaxed whitespace-pre-wrap font-sans overflow-y-auto"
                              style={{ color: '#94afee', maxHeight: '200px' }}
                            >
                              {set.notes}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 text-xs" style={{ color: '#2d5299' }}>
                    To use these notes when generating a post, select them on the &quot;New Post&quot; page.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

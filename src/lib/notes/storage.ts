/**
 * localStorage helpers for the course notes library.
 *
 * Notes are saved client-side only — no database required.
 * The library holds up to MAX_SAVED entries; oldest are evicted automatically.
 *
 * Storage key: NOTES_LIBRARY_KEY
 * Shape:       SavedNoteSet[]  (sorted newest-first)
 */

export const NOTES_LIBRARY_KEY = 'drafture_notes_library_v1'
const MAX_SAVED = 10

export interface SavedNoteSet {
  id: string         // UUID v4 (crypto.randomUUID)
  label: string      // display name — defaults to course or PDF filenames
  course: string     // course name if the user provided one
  pdfNames: string[] // original PDF filenames for context
  notes: string      // the full markdown notes text
  savedAt: string    // ISO-8601 timestamp
}

function load(): SavedNoteSet[] {
  try {
    const raw = localStorage.getItem(NOTES_LIBRARY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function save(sets: SavedNoteSet[]): void {
  try {
    localStorage.setItem(NOTES_LIBRARY_KEY, JSON.stringify(sets))
  } catch {
    // Storage quota exceeded or unavailable — fail silently
  }
}

/** Return all saved note sets, newest-first. */
export function listNoteSets(): SavedNoteSet[] {
  return load()
}

/** Persist a new note set. Evicts the oldest if over MAX_SAVED. */
export function addNoteSet(set: Omit<SavedNoteSet, 'id' | 'savedAt'>): SavedNoteSet {
  const newSet: SavedNoteSet = {
    ...set,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  }
  const existing = load()
  const updated = [newSet, ...existing].slice(0, MAX_SAVED)
  save(updated)
  return newSet
}

/** Remove a saved note set by id. */
export function removeNoteSet(id: string): void {
  const updated = load().filter((s) => s.id !== id)
  save(updated)
}

/**
 * Return a truncated version of the notes for use as generation context.
 * Long notes are trimmed so they don't inflate token costs — the generate
 * prompt needs context, not the full study guide.
 */
export function notesContextSnippet(notes: string, maxChars = 4000): string {
  if (notes.length <= maxChars) return notes
  // Trim at the last newline before the limit so we don't cut mid-sentence
  const truncated = notes.slice(0, maxChars)
  const lastNewline = truncated.lastIndexOf('\n')
  return (lastNewline > maxChars * 0.6 ? truncated.slice(0, lastNewline) : truncated) +
    '\n\n[...notes truncated for length]'
}

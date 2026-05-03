'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, FileText, Plus, ExternalLink } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import { cn } from '@/lib/utils'

interface ReportSummaryItem {
  id: string
  title: string
  area: string
  summary: string | null
  /** Parsed insights array — risk/anomaly/quote/etc. */
  insights: Array<{ type: string; text: string }>
  /** Extracted entities for this report. */
  entities: Array<{ id: string; type: string; name: string }>
}

interface ReportPickerOption {
  id: string
  title: string
  area: string
}

interface NoteItem {
  id: string
  title: string
  content: string
  folder: string
}

interface Props {
  /** The Tiptap editor — used to insert content at cursor. Null until editor is ready. */
  editor: Editor | null
  /** All reports in the project — used for the picker. */
  allReports: ReportPickerOption[]
  /** ProjectId — used to fetch notebook notes. */
  projectId: string
  /** IDs of reports currently attached to this story. */
  attachedReportIds: string[]
  /** Loaded summary/insights/entities for attached reports (lazy-fetched by parent). */
  attachedReports: ReportSummaryItem[]
  /** Loading flag from parent. */
  loading: boolean
  /** Called when the picker selection changes. Parent persists via /api/journal/[id]/structure. */
  onChangeReportIds: (ids: string[]) => void
}

const ENTITY_TYPE_ORDER = ['person', 'organisation', 'location', 'date', 'financial']

function entityTypeColor(type: string): string {
  switch (type) {
    case 'person':       return 'bg-[var(--blue-dim)] text-[var(--blue)]'
    case 'organisation': return 'bg-[var(--amber-dim)] text-[var(--amber)]'
    case 'location':     return 'bg-[var(--green-dim)] text-[var(--green)]'
    case 'date':         return 'bg-[var(--surface-3)] text-[var(--text-subtle)]'
    case 'financial':    return 'bg-[var(--red-dim)] text-[var(--red)]'
    default:             return 'bg-[var(--surface-3)] text-[var(--text-subtle)]'
  }
}

export default function StoryDocumentsPanel({
  editor,
  allReports,
  attachedReportIds,
  attachedReports,
  loading,
  onChangeReportIds,
  projectId,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  // Start empty — user controls which docs are expanded. No auto-expand that fights toggles.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [notesExpanded, setNotesExpanded] = useState(false)

  // Load project notes from the Notebook
  useEffect(() => {
    if (!projectId) return
    fetch('/api/journal')
      .then(r => r.json())
      .then((d: { entries?: NoteItem[] }) => {
        // Filter to this project's notes (by projectId) that have content
        const projectNotes = (d.entries ?? []).filter(
          e => e.content && e.content.trim().length > 0
        )
        setNotes(projectNotes)
      })
      .catch(() => {})
  }, [projectId])

  const insertNote = (note: NoteItem) => {
    if (!editor) return
    // Strip HTML to plain text for insertion
    const plain = note.content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .trim()
    if (plain) editor.chain().focus().insertContent(`<p>${plain.replace(/\n/g, '<br/>')}</p>`).run()
  }

  const toggleReport = (id: string) => {
    const next = attachedReportIds.includes(id)
      ? attachedReportIds.filter(r => r !== id)
      : [...attachedReportIds, id]
    onChangeReportIds(next)
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const insertAtCursor = (text: string) => {
    if (!editor) return
    editor.chain().focus().insertContent(text).run()
  }

  const filteredPickerReports = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allReports
    return allReports.filter(r =>
      r.title.toLowerCase().includes(q) || r.area.toLowerCase().includes(q),
    )
  }, [allReports, search])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Documents {attachedReports.length > 0 && (
              <span className="text-[var(--text-body)]">({attachedReports.length})</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => setPickerOpen(o => !o)}
            className={cn(
              'inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full transition-colors',
              pickerOpen
                ? 'bg-[var(--ink)] text-[var(--ink-contrast)]'
                : 'bg-[var(--blue-dim)] text-[var(--blue)] hover:opacity-80'
            )}
          >
            <Plus size={11} />
            {pickerOpen ? 'Done' : 'Attach'}
          </button>
        </div>

        {/* Picker */}
        {pickerOpen && (
          <div className="space-y-1.5">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search documents…"
              className="w-full h-7 px-2.5 text-[11px] border border-[var(--border)] bg-[var(--surface-2)] rounded-[6px] text-[var(--text-body)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--blue)] focus:border-[var(--blue)]"
            />
            <div className="max-h-40 overflow-y-auto border border-[var(--border)] rounded-[6px]">
              {filteredPickerReports.length === 0 ? (
                <p className="text-[11px] text-[var(--text-muted)] italic px-2.5 py-2">No matches.</p>
              ) : filteredPickerReports.map(r => (
                <label
                  key={r.id}
                  className="flex items-start gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-[var(--surface-2)] border-b border-[var(--border)] last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={attachedReportIds.includes(r.id)}
                    onChange={() => toggleReport(r.id)}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] text-[var(--text-body)] truncate">{r.title}</p>
                    <p className="text-[9px] font-mono text-[var(--text-muted)] mt-0.5">{r.area}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Attached docs list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-[11px] text-[var(--text-muted)] px-3 py-4">Loading…</p>
        ) : attachedReports.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <FileText size={20} className="mx-auto text-[var(--border)] mb-2" />
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              No documents attached yet.
              {!pickerOpen && (
                <>
                  {' '}Click <button type="button" onClick={() => setPickerOpen(true)} className="text-[var(--blue)] hover:underline">Attach</button> above to add some.
                </>
              )}
            </p>
          </div>
        ) : attachedReports.map(r => {
          const isExpanded = expandedIds.has(r.id)
          // Sort entities so persons come first, then orgs, etc.
          const sortedEntities = [...r.entities].sort((a, b) => {
            const ai = ENTITY_TYPE_ORDER.indexOf(a.type)
            const bi = ENTITY_TYPE_ORDER.indexOf(b.type)
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
          })
          // Dedupe entities by name (multiple extractions of same name in one doc)
          const seenNames = new Set<string>()
          const uniqueEntities = sortedEntities.filter(e => {
            const k = `${e.type}:${e.name.toLowerCase()}`
            if (seenNames.has(k)) return false
            seenNames.add(k)
            return true
          })

          return (
            <div key={r.id} className="border-b border-[var(--border)] last:border-b-0">
              <button
                type="button"
                onClick={() => toggleExpanded(r.id)}
                className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-[var(--surface-2)] transition-colors text-left"
              >
                {isExpanded
                  ? <ChevronDown size={11} className="shrink-0 mt-0.5 text-[var(--text-muted)]" />
                  : <ChevronRight size={11} className="shrink-0 mt-0.5 text-[var(--text-muted)]" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-[var(--text-bright)] line-clamp-2 leading-snug">{r.title}</p>
                  <p className="text-[9px] font-mono text-[var(--text-muted)] mt-0.5">{r.area}</p>
                </div>
                <Link
                  href={`/reports/${r.id}`}
                  onClick={e => e.stopPropagation()}
                  title="Open document"
                  className="shrink-0 p-1 -m-1 rounded text-[var(--text-muted)] hover:text-[var(--text-body)]"
                >
                  <ExternalLink size={11} />
                </Link>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-3">
                  {/* Summary */}
                  {r.summary && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Summary</p>
                        <button
                          type="button"
                          onClick={() => insertAtCursor(r.summary ?? '')}
                          disabled={!editor}
                          className="text-[9px] text-[var(--blue)] hover:opacity-80 transition-opacity disabled:opacity-40"
                          title="Insert at cursor"
                        >
                          + Insert
                        </button>
                      </div>
                      <p className="text-[11px] text-[var(--text-body)] leading-relaxed">{r.summary}</p>
                    </div>
                  )}

                  {/* Entities */}
                  {uniqueEntities.length > 0 && (
                    <div className="space-y-1">
                      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Entities · click to insert
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {uniqueEntities.slice(0, 30).map(e => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => insertAtCursor(e.name)}
                            disabled={!editor}
                            title={`Insert "${e.name}" at cursor`}
                            className={cn(
                              'inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded transition-opacity disabled:opacity-40 hover:opacity-80',
                              entityTypeColor(e.type)
                            )}
                          >
                            {e.name}
                          </button>
                        ))}
                        {uniqueEntities.length > 30 && (
                          <span className="text-[9px] font-mono text-[var(--text-muted)] px-1.5 py-0.5">
                            +{uniqueEntities.length - 30} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Insights */}
                  {r.insights.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Insights · click to insert
                      </p>
                      <div className="space-y-1">
                        {r.insights.slice(0, 8).map((ins, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => insertAtCursor(ins.text)}
                            disabled={!editor}
                            title="Insert insight at cursor"
                            className="w-full text-left text-[11px] text-[var(--text-body)] leading-relaxed hover:bg-[var(--surface-2)] rounded px-2 py-1 -mx-2 transition-colors disabled:opacity-40"
                          >
                            <span
                              className={cn(
                                'inline-block text-[9px] font-mono px-1.5 py-0.5 rounded mr-1.5',
                                ins.type === 'risk'    ? 'bg-[var(--red-dim)] text-[var(--red)]'
                                : ins.type === 'anomaly' ? 'bg-[var(--amber-dim)] text-[var(--amber)]'
                                : 'bg-[var(--surface-3)] text-[var(--text-subtle)]'
                              )}
                            >
                              {ins.type}
                            </span>
                            {ins.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!r.summary && uniqueEntities.length === 0 && r.insights.length === 0 && (
                    <p className="text-[10px] text-[var(--text-muted)] italic">No analysis available for this document.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Notes section — notebook entries, insertable into the prose editor */}
      {notes.length > 0 && (
        <div className="border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => setNotesExpanded(o => !o)}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 hover:bg-[var(--surface-2)] transition-colors"
          >
            {notesExpanded
              ? <ChevronDown size={11} className="text-[var(--text-muted)] shrink-0" />
              : <ChevronRight size={11} className="text-[var(--text-muted)] shrink-0" />}
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] flex-1 text-left">
              Notes · {notes.length}
            </span>
            <span className="text-[9px] text-[var(--text-muted)]">click to insert</span>
          </button>
          {notesExpanded && (
            <div>
              {notes.map(note => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => insertNote(note)}
                  disabled={!editor}
                  className="w-full text-left px-3.5 py-2 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40"
                >
                  <p className="text-[11.5px] font-medium text-[var(--text-body)] truncate">{note.title}</p>
                  {note.folder !== 'General' && (
                    <p className="text-[9px] font-mono text-[var(--text-muted)] mt-0.5">{note.folder}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

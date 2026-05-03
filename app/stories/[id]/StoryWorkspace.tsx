'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2, Share2, Download, Printer, FileText, FileType2 } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import LayoutA from '@/components/layouts/LayoutA'
import JournalEditor from '@/app/journal/JournalEditor'
import StoryDocumentsPanel from '@/components/journal/StoryDocumentsPanel'
import StoryStructurePanel from './StoryStructurePanel'
import { cn, parseJsonSafe } from '@/lib/utils'

interface ProjectProps {
  id: string
  name: string
  narrative: string
  storyStatus: string
  storyDescription: string | null
  storyReportIds: string
  storyEvents: string
  storyClaimStatuses: string
}

interface ReportOption {
  id: string
  title: string
  area: string
}

interface ReportSummaryItem {
  id: string
  title: string
  area: string
  summary: string | null
  insights: Array<{ type: string; text: string }>
  entities: Array<{ id: string; type: string; name: string }>
}

interface Props {
  project: ProjectProps
  allReports: ReportOption[]
}

const STATUS_LABELS: Record<string, string> = { draft: 'Draft', writing: 'Writing', filed: 'Filed' }
const STATUS_DOT: Record<string, string>    = { draft: 'bg-[var(--green)]', writing: 'bg-[var(--amber)]', filed: 'bg-[var(--text-muted)]' }

// Debounced autosave for the prose
const SAVE_DEBOUNCE = 800

export default function StoryWorkspace({ project, allReports }: Props) {
  const router = useRouter()
  const [name, setName] = useState(project.name)
  const [storyStatus, setStoryStatus] = useState(project.storyStatus)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const narrativeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  // Story = Project: if no explicit doc attachments yet, auto-include ALL project docs
  // so the workspace shows full context immediately (docs are already scoped to this project).
  const storedReportIds = parseJsonSafe<string[]>(project.storyReportIds, [])
  const initialReportIds = storedReportIds.length > 0 ? storedReportIds : allReports.map(r => r.id)
  const [attachedReportIds, setAttachedReportIds] = useState<string[]>(initialReportIds)
  const [attachedReports, setAttachedReports] = useState<ReportSummaryItem[]>([])
  const [docsLoading, setDocsLoading] = useState(false)

  // Close export menu on outside click
  useEffect(() => {
    if (!exportMenuOpen) return
    const h = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenuOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [exportMenuOpen])

  // Notify ProjectSwitcher + breadcrumb when the active story changes
  useEffect(() => {
    window.dispatchEvent(new Event('project:changed'))
    window.dispatchEvent(new CustomEvent('story:active', { detail: { id: project.id, name } }))
  }, [project.id, name])

  // Load doc summaries/entities when attached list changes
  useEffect(() => {
    if (attachedReportIds.length === 0) { setAttachedReports([]); return }
    let cancelled = false
    setDocsLoading(true)
    void (async () => {
      try {
        const params = new URLSearchParams()
        for (const id of attachedReportIds) params.append('id', id)
        const res = await fetch(`/api/reports/by-ids?${params.toString()}`)
        if (!res.ok) return
        const data = await res.json() as { reports: ReportSummaryItem[] }
        if (!cancelled) setAttachedReports(data.reports ?? [])
      } finally {
        if (!cancelled) setDocsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [attachedReportIds])

  // Patch project story fields
  const patchStory = useCallback(async (data: Record<string, unknown>) => {
    await fetch(`/api/projects/${project.id}/story`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  }, [project.id])

  // Name autosave
  useEffect(() => {
    if (name === project.name) return
    if (nameTimer.current) clearTimeout(nameTimer.current)
    nameTimer.current = setTimeout(() => patchStory({ name }), SAVE_DEBOUNCE)
    return () => { if (nameTimer.current) clearTimeout(nameTimer.current) }
  }, [name, project.name, patchStory])

  const handleStatusChange = async (next: string) => {
    setStoryStatus(next)
    await patchStory({ storyStatus: next })
  }

  const handleReportIdsChange = useCallback(async (next: string[]) => {
    setAttachedReportIds(next)
    await patchStory({ storyReportIds: next })
  }, [patchStory])

  // Narrative autosave (via onContentChange on JournalEditor)
  const handleNarrativeChange = useCallback((html: string) => {
    if (narrativeTimer.current) clearTimeout(narrativeTimer.current)
    narrativeTimer.current = setTimeout(() => patchStory({ narrative: html }), SAVE_DEBOUNCE)
  }, [patchStory])

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    window.dispatchEvent(new Event('project:changed'))
    router.push('/stories')
    router.refresh()
  }

  const handleExport = async (format: 'html' | 'docx' | 'print') => {
    setExportMenuOpen(false)
    if (format === 'print') { window.print(); return }
    setExporting(format)
    try {
      const res = await fetch(`/api/stories/${project.id}/export?format=${format}`)
      if (!res.ok) return
      const blob = await res.blob()
      const cd = res.headers.get('content-disposition') ?? ''
      const fnMatch = cd.match(/filename="([^"]+)"/)
      const filename = fnMatch ? decodeURIComponent(fnMatch[1]) : `story.${format}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(null) }
  }

  const header = (
    <div className="px-7 py-3.5 flex items-center gap-3">
      <Link href="/stories" className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors shrink-0">
        <ArrowLeft size={13} /> Stories
      </Link>
      <span className="text-[var(--border)] shrink-0">/</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT[storyStatus] ?? STATUS_DOT.draft)} />
        <select
          value={storyStatus}
          onChange={e => handleStatusChange(e.target.value)}
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] bg-transparent border-0 focus:outline-none cursor-pointer shrink-0 hover:text-[var(--text-body)] transition-colors"
        >
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        className="flex-1 min-w-0 text-base font-semibold bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--border-mid)] focus:outline-none text-[var(--text-bright)] py-0.5 transition-colors"
      />
      {/* Collab — links to real peer-sharing setup (ProjectShare infrastructure) */}
      <Link
        href="/collab"
        title="Set up peer sharing for this story via Collab"
        className="shrink-0 inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-body)] hover:border-[var(--border-mid)] transition-colors"
      >
        <Share2 size={11} /> Collab
      </Link>
      {/* Export */}
      <div ref={exportMenuRef} className="relative shrink-0">
        <button type="button" onClick={() => setExportMenuOpen(o => !o)} disabled={exporting !== null}
          className={cn('inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-[var(--ink)] text-[var(--ink-contrast)] hover:opacity-90 transition-colors', exporting !== null && 'opacity-60')}>
          <Download size={11} />{exporting ? `Exporting…` : 'Export'}
        </button>
        {exportMenuOpen && (
          <div className="absolute right-0 top-full mt-1 z-30 w-52 bg-[var(--surface)] border border-[var(--border)] rounded-[10px] shadow-xl overflow-hidden py-1">
            <button type="button" onClick={() => handleExport('html')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-[var(--text-body)] hover:bg-[var(--surface-2)]">
              <FileText size={13} className="text-[var(--text-muted)]" /><div><div className="font-medium">HTML</div><div className="text-[10px] text-[var(--text-muted)]">Standalone web page</div></div>
            </button>
            <button type="button" onClick={() => handleExport('docx')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-[var(--text-body)] hover:bg-[var(--surface-2)]">
              <FileType2 size={13} className="text-[var(--text-muted)]" /><div><div className="font-medium">Word (.docx)</div><div className="text-[10px] text-[var(--text-muted)]">Editable Word file</div></div>
            </button>
            <div className="mx-2 my-1 h-px bg-[var(--border)]" />
            <button type="button" onClick={() => handleExport('print')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-[var(--text-body)] hover:bg-[var(--surface-2)]">
              <Printer size={13} className="text-[var(--text-muted)]" /><div><div className="font-medium">Print → PDF</div><div className="text-[10px] text-[var(--text-muted)]">Browser print dialog</div></div>
            </button>
          </div>
        )}
      </div>
      <button type="button" onClick={handleDelete}
        className={cn('shrink-0 text-xs px-2.5 py-1.5 rounded-full border transition-colors',
          confirmDelete ? 'border-[var(--red)] text-[var(--red)] bg-[var(--red-dim)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-body)]'
        )}
        title={confirmDelete ? 'Click again to delete this story and all its data' : 'Delete story'}>
        <Trash2 size={12} />
      </button>
    </div>
  )

  // Left: Documents explorer + Notes (both insertable into the prose editor)
  const sidebar = (
    <StoryDocumentsPanel
      editor={editor}
      allReports={allReports}
      attachedReportIds={attachedReportIds}
      attachedReports={attachedReports}
      loading={docsLoading}
      onChangeReportIds={handleReportIdsChange}
      projectId={project.id}
    />
  )

  // Center: Tiptap prose editor — autosaves to project.narrative
  const centerContent = (
    <div className="px-7 py-6">
      <JournalEditor
        key={project.id}
        entryId={project.id}
        initialContent={project.narrative}
        onContentChange={handleNarrativeChange}
        onReady={setEditor}
        disableAutosave
      />
    </div>
  )

  // Right: story structure panel (status, claims, events, evidence, share)
  const aside = (
    <StoryStructurePanel
      projectId={project.id}
      initialStatus={storyStatus}
      initialDescription={project.storyDescription}
      initialReportIds={attachedReportIds}
      initialEvents={project.storyEvents}
      initialClaimStatuses={project.storyClaimStatuses}
      allReports={allReports}
      onStatusChange={handleStatusChange}
      onDemote={() => { router.push('/stories'); router.refresh() }}
      onNarrativeGenerated={html => {
        // Apply generated narrative directly to the Tiptap editor if ready,
        // otherwise the patchStory call in the panel already saved it to the DB.
        if (editor) editor.commands.setContent(html)
      }}
    />
  )

  return (
    <LayoutA header={header} sidebar={sidebar} aside={aside} sidebarWidth={280} asideWidth={320}>
      {centerContent}
    </LayoutA>
  )
}

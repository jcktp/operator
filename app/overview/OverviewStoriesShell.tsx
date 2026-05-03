'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, ChevronRight, FileText, Music, Image as ImageIcon } from 'lucide-react'
import LayoutA from '@/components/layouts/LayoutA'
import SearchInput from '@/components/ui/SearchInput'
import NewStoryModal from '@/components/journal/NewStoryModal'
import { AreaBadge } from '@/components/Badge'
import { cn, formatRelativeDate } from '@/lib/utils'

// ── Serialised data shapes ─────────────────────────────────────────────────────

export interface StoryDocumentEntity {
  id: string
  type: string
  name: string
}

export interface StoryDocumentFlag {
  type: string
  text: string
}

export interface StoryDocument {
  id: string
  title: string
  area: string
  fileType: string
  fileSize: number
  createdAt: string
  flagCount: number
  displayContent?: string | null
  entities: StoryDocumentEntity[]
  flags: StoryDocumentFlag[]
}

export interface StoryEvent {
  id: string
  date: string
  description: string
  actors?: string[]
}

export interface StoryFlag {
  type: string
  text: string
  reportTitle: string
  reportId: string
}

export interface StoryItem {
  id: string
  title: string
  status: 'draft' | 'writing' | 'filed' | string
  area: string | null
  description: string | null
  reportIds: string[]
  events: StoryEvent[]
  documents: StoryDocument[]
  flagCount: number
  updatedAt: string
  /** First ~250 plain-text chars of the prose draft, or null if empty */
  draftSnippet: string | null
  /** Up to 5 most relevant flags across this story's documents */
  storyFlags: StoryFlag[]
  /** Up to 20 unique entities across this story's documents */
  storyEntities: StoryDocumentEntity[]
}

export interface RecentActivityItem {
  id: string
  title: string
  area: string
  createdAt: string
  flagCount: number
}

export interface OverviewStoriesData {
  stories: StoryItem[]
  totalDocs: number
  totalFlags: number
  activeCount: number
  recentActivity: RecentActivityItem[]
  totalReportsInProject: string
  /** All reports in current project (for the New Story modal's document picker). */
  allReports: Array<{ id: string; title: string; area: string }>
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusDot(status: string): string {
  // green = active/draft, amber = writing/in-progress signals, neutral = filed
  if (status === 'filed') return 'bg-[var(--text-muted)]'
  if (status === 'writing') return 'bg-[var(--amber)]'
  return 'bg-[var(--green)]'
}

function statusLabel(status: string): string {
  if (status === 'filed') return 'filed'
  if (status === 'writing') return 'writing'
  return 'active'
}

function fileKindFromReport(d: StoryDocument): { label: string; Icon: React.ComponentType<{ size?: number; className?: string }> } {
  const dc = d.displayContent ?? ''
  if (dc.startsWith('image:')) return { label: 'PHOTO', Icon: ImageIcon }
  if (dc.startsWith('audio:')) return { label: 'AUDIO', Icon: Music }
  return { label: (d.fileType || 'DOC').toUpperCase().slice(0, 5), Icon: FileText }
}

function formatBytes(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Shell ──────────────────────────────────────────────────────────────────────

export default function OverviewStoriesShell({ data }: { data: OverviewStoriesData }) {
  const { stories, totalDocs, totalFlags, activeCount, recentActivity, totalReportsInProject, allReports } = data
  const [selectedId, setSelectedId] = useState<string | null>(stories[0]?.id ?? null)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const handleCreateStory = () => setModalOpen(true)
  const creating = false  // modal owns its own submitting state

  const filteredStories = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return stories
    return stories.filter(s =>
      s.title.toLowerCase().includes(q) ||
      (s.description ?? '').toLowerCase().includes(q)
    )
  }, [stories, search])

  const selected = stories.find(s => s.id === selectedId) ?? null

  // ── Sidebar (Stories list) ───────────────────────────────────────────────
  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[var(--border)] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Stories</span>
            <button
              type="button"
              onClick={handleCreateStory}
              disabled={creating}
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full bg-[var(--blue-dim)] text-[var(--blue)] hover:opacity-80 transition-colors disabled:opacity-40"
            >
              <Plus size={11} />
              New
            </button>
          </div>

          {/* Search */}
          <SearchInput
            size="sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search stories…"
            clearable
          />

          {/* Stats row */}
          <div className="flex gap-5 pt-1">
            <Stat value={totalDocs} label="docs" />
            <Stat value={totalFlags} label="flags" />
            <Stat value={activeCount} label="active" />
          </div>
        </div>

        {/* Story list */}
        <div className="flex-1 overflow-y-auto">
          {filteredStories.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                {search.trim() ? 'No stories match.' : 'No stories yet — click + New to create one.'}
              </p>
            </div>
          ) : (
            filteredStories.map(s => {
              const isActive = s.id === selectedId
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    'w-full text-left transition-colors border-l-2 border-b border-[var(--border)] last:border-b-0',
                    isActive
                      ? 'border-l-[var(--blue)] bg-[var(--blue-dim)]'
                      : 'border-l-transparent hover:bg-[var(--surface-2)]'
                  )}
                >
                  <div className="px-3.5 py-2.5">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className={cn('text-[12.5px] leading-tight line-clamp-2 flex-1', isActive ? 'font-semibold text-[var(--text-bright)]' : 'font-medium text-[var(--text-body)]')}>
                        {s.title}
                      </span>
                      {s.flagCount > 0 && (
                        <span className="shrink-0 text-[9px] font-mono text-[var(--red)]">⚑ {s.flagCount}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusDot(s.status))} />
                      {s.area ? <AreaBadge area={s.area} className="!text-[9px] !px-1.5 !py-0" /> : <span className="text-[9px] font-mono text-[var(--text-muted)]">no area</span>}
                      <span className="ml-auto text-[9px] font-mono text-[var(--text-muted)]">{formatRelativeDate(s.updatedAt)}</span>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
    </div>
  )

  // ── Right aside (timeline) ───────────────────────────────────────────────
  const aside = (
    <div className="p-4">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] pb-3 mb-3 border-b border-[var(--border)]">Timeline</p>
      {selected && selected.events.length > 0 ? (
        <div>
          {selected.events.map((ev, i) => (
            <div key={ev.id} className="flex gap-2.5">
              <div className="flex flex-col items-center shrink-0 pt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--blue)]" />
                {i < selected.events.length - 1 && <div className="w-px flex-1 bg-[var(--border)] mt-1 min-h-[20px]" />}
              </div>
              <div className="pb-3 min-w-0">
                <p className="text-[9px] font-mono text-[var(--text-muted)] mb-0.5 break-words">{ev.date || '—'}</p>
                <p className="text-[11px] text-[var(--text-body)] leading-snug break-words">{ev.description}</p>
                {ev.actors && ev.actors.length > 0 && (
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5 break-words">{ev.actors.join(', ')}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">{selected ? 'No timeline events yet.' : 'Select a story to see its timeline.'}</p>
      )}
    </div>
  )

  return (
    <>
      <LayoutA sidebar={sidebar} aside={aside} sidebarWidth={256} asideWidth={220}>
        <div className="px-7 py-6">
          {selected ? (
            <StoryDetail story={selected} />
          ) : (
            <EmptyDetail
              onCreate={handleCreateStory}
              creating={creating}
              recentActivity={recentActivity}
              totalReportsInProject={totalReportsInProject}
              hasStories={stories.length > 0}
            />
          )}
        </div>
      </LayoutA>
      <NewStoryModal open={modalOpen} onClose={() => setModalOpen(false)} allReports={allReports} />
    </>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-[18px] font-bold leading-none text-[var(--text-bright)]">{value}</div>
      <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-muted)] mt-1">{label}</div>
    </div>
  )
}

function entityChipColor(type: string): string {
  switch (type) {
    case 'person':       return 'bg-[var(--blue-dim)] text-[var(--blue)]'
    case 'organisation': return 'bg-[var(--amber-dim)] text-[var(--amber)]'
    case 'location':     return 'bg-[var(--green-dim)] text-[var(--green)]'
    case 'date':         return 'bg-[var(--surface-3)] text-[var(--text-subtle)]'
    case 'financial':    return 'bg-[var(--red-dim)] text-[var(--red)]'
    default:             return 'bg-[var(--surface-3)] text-[var(--text-subtle)]'
  }
}

function flagBadgeColor(type: string): string {
  if (type === 'risk')    return 'bg-[var(--red-dim)] text-[var(--red)]'
  if (type === 'anomaly') return 'bg-[var(--amber-dim)] text-[var(--amber)]'
  return 'bg-[var(--surface-3)] text-[var(--text-subtle)]'
}

function StoryDetail({ story }: { story: StoryItem }) {
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())
  const toggleDoc = (id: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <article className="space-y-5">
      {/* Status row */}
      <div className="flex items-center gap-2 pb-4 border-b border-[var(--border)]">
        <span className={cn('w-1.5 h-1.5 rounded-full', statusDot(story.status))} />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{statusLabel(story.status)}</span>
        {story.area && <AreaBadge area={story.area} />}
        <span className="font-mono text-[10px] text-[var(--text-muted)]">
          {story.documents.length} doc{story.documents.length !== 1 ? 's' : ''} · {formatRelativeDate(story.updatedAt)}
        </span>
        <Link
          href={`/stories/${story.id}`}
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium px-3 py-1 rounded-full bg-[var(--blue)] text-white hover:opacity-90 transition-colors"
        >
          Open story →
        </Link>
      </div>

      {/* Title + description */}
      <header className="space-y-2">
        <h1 className="text-[20px] font-bold tracking-tight text-[var(--text-bright)]">{story.title}</h1>
        {story.description && (
          <p className="text-[12.5px] text-[var(--text-subtle)] leading-relaxed max-w-[640px]">{story.description}</p>
        )}
      </header>

      {/* Draft snippet — first ~250 chars of the prose, click to open full editor */}
      {story.draftSnippet && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Draft</p>
            <Link href={`/stories/${story.id}`} className="text-[10px] text-[var(--blue)] hover:opacity-80 transition-opacity">
              Continue writing →
            </Link>
          </div>
          <Link
            href={`/stories/${story.id}`}
            className="block bg-[var(--surface)] border border-[var(--border)] rounded-[10px] px-4 py-3 hover:border-[var(--border-mid)] transition-colors"
          >
            <p className="text-[12.5px] text-[var(--text-body)] leading-relaxed line-clamp-4">{story.draftSnippet}</p>
          </Link>
        </section>
      )}

      {/* Flags — actual list, not just a count */}
      {story.storyFlags.length > 0 && (
        <section>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] mb-2">
            Flags · {story.flagCount}
          </p>
          <div className="space-y-1.5">
            {story.storyFlags.map((f, i) => (
              <Link
                key={i}
                href={`/reports/${f.reportId}`}
                className={cn(
                  'block px-3 py-2 rounded-[6px] border-l-3 hover:opacity-90 transition-opacity',
                  f.type === 'risk'
                    ? 'bg-[var(--red-dim)] border-l-[var(--red)]'
                    : 'bg-[var(--amber-dim)] border-l-[var(--amber)]'
                )}
                style={{ borderLeftWidth: 3 }}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={cn('inline-block font-mono text-[9px] px-1.5 py-0.5 rounded', flagBadgeColor(f.type))}>
                    {f.type}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] truncate">{f.reportTitle}</span>
                </div>
                <p className="text-[12px] text-[var(--text-body)] leading-snug">{f.text}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Entities — clickable chips, link to /entities filtered/focus */}
      {story.storyEntities.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Entities · {story.storyEntities.length}
            </p>
            <Link href="/entities" className="text-[10px] text-[var(--blue)] hover:opacity-80 transition-opacity">
              All entities →
            </Link>
          </div>
          <div className="flex flex-wrap gap-1">
            {story.storyEntities.map(e => (
              <Link
                key={e.id}
                href={`/entities?focus=${encodeURIComponent(e.name)}`}
                title={`Open ${e.name} in Entities`}
                className={cn(
                  'inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded transition-opacity hover:opacity-80',
                  entityChipColor(e.type)
                )}
              >
                {e.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Documents — click to expand for entities + open the full report */}
      {story.documents.length > 0 && (
        <section>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] mb-2.5">Documents</p>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
            {story.documents.map(d => {
              const { label, Icon } = fileKindFromReport(d)
              const isExpanded = expandedDocs.has(d.id)
              return (
                <div key={d.id} className="border-b border-[var(--border)] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => toggleDoc(d.id)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[var(--surface-2)] transition-colors text-left"
                  >
                    <span className="font-mono text-[9px] px-1.5 py-0.5 bg-[var(--surface-3)] text-[var(--text-muted)] rounded shrink-0 inline-flex items-center gap-1">
                      <Icon size={9} />
                      {label}
                    </span>
                    <span className="text-[12.5px] font-medium text-[var(--text-bright)] flex-1 truncate">{d.title}</span>
                    {d.flagCount > 0 && <span className="font-mono text-[10px] text-[var(--red)] shrink-0">⚑ {d.flagCount}</span>}
                    {d.fileSize > 0 && <span className="font-mono text-[10px] text-[var(--text-muted)] shrink-0">{formatBytes(d.fileSize)}</span>}
                    <span className="font-mono text-[10px] text-[var(--text-muted)] shrink-0">{formatRelativeDate(d.createdAt)}</span>
                    <ChevronRight
                      size={12}
                      className={cn('text-[var(--border-mid)] shrink-0 transition-transform', isExpanded && 'rotate-90')}
                    />
                  </button>
                  {isExpanded && (
                    <div className="px-3.5 pb-3 space-y-2 bg-[var(--surface-2)]">
                      {/* Entities for this doc */}
                      {d.entities.length > 0 && (
                        <div>
                          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] mb-1.5 pt-2">Entities</p>
                          <div className="flex flex-wrap gap-1">
                            {d.entities.map(e => (
                              <Link
                                key={e.id}
                                href={`/entities?focus=${encodeURIComponent(e.name)}`}
                                className={cn(
                                  'inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded transition-opacity hover:opacity-80',
                                  entityChipColor(e.type)
                                )}
                              >
                                {e.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Flags for this doc */}
                      {d.flags.length > 0 && (
                        <div>
                          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] mb-1.5">Flags</p>
                          <div className="space-y-1">
                            {d.flags.map((f, i) => (
                              <p key={i} className="text-[11px] text-[var(--text-body)] leading-snug">
                                <span className={cn('inline-block font-mono text-[9px] px-1.5 py-0.5 rounded mr-1.5', flagBadgeColor(f.type))}>
                                  {f.type}
                                </span>
                                {f.text}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="pt-1">
                        <Link
                          href={`/reports/${d.id}`}
                          className="inline-flex items-center gap-1 text-[10px] text-[var(--blue)] hover:opacity-80 transition-opacity"
                        >
                          Open full report →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </article>
  )
}

function EmptyDetail({
  onCreate,
  creating,
  recentActivity,
  totalReportsInProject,
  hasStories,
}: {
  onCreate: () => void
  creating: boolean
  recentActivity: RecentActivityItem[]
  totalReportsInProject: string
  hasStories: boolean
}) {
  return (
    <div className="space-y-6">
      {/* CTA card */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] px-5 py-5 flex items-center gap-4">
        <div className="w-10 h-10 bg-[var(--blue-dim)] rounded-[10px] flex items-center justify-center shrink-0">
          <FileText size={16} className="text-[var(--blue)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[14px] font-semibold text-[var(--text-bright)] mb-0.5">
            {hasStories ? 'Pick a story from the sidebar' : 'No stories yet'}
          </h2>
          <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
            {hasStories
              ? 'Or start a new one to track sources, claims, evidence and the draft in one place.'
              : 'Stories let you collect sources, claims, evidence, timeline and draft in one place.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-3.5 py-1.5 rounded-full bg-[var(--ink)] text-[var(--ink-contrast)] hover:opacity-90 transition-colors disabled:opacity-40 shrink-0"
        >
          <Plus size={12} />
          New story
        </button>
      </div>

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Recent activity · {totalReportsInProject} {totalReportsInProject === '1' ? 'document' : 'documents'}
            </p>
            <Link
              href="/dashboard"
              className="text-[11px] text-[var(--blue)] hover:opacity-80 transition-opacity"
            >
              Open Situation Report →
            </Link>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
            {recentActivity.map(r => (
              <Link
                key={r.id}
                href={`/reports/${r.id}`}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-2)] transition-colors"
              >
                <span className="font-mono text-[9px] px-1.5 py-0.5 bg-[var(--surface-3)] text-[var(--text-muted)] rounded shrink-0">DOC</span>
                <span className="text-[12.5px] font-medium text-[var(--text-bright)] flex-1 truncate">{r.title}</span>
                {r.flagCount > 0 && <span className="font-mono text-[10px] text-[var(--red)] shrink-0">⚑ {r.flagCount}</span>}
                <span className="font-mono text-[10px] text-[var(--text-muted)] shrink-0">{r.area}</span>
                <span className="font-mono text-[10px] text-[var(--text-muted)] shrink-0">{formatRelativeDate(r.createdAt)}</span>
                <ChevronRight size={12} className="text-[var(--border-mid)] shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {recentActivity.length === 0 && (
        <div className="text-center py-8">
          <p className="text-[12px] text-[var(--text-muted)] mb-3">
            No documents yet — add some to start populating your stories.
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-3.5 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-body)] hover:bg-[var(--surface-3)] transition-colors"
          >
            <Plus size={12} /> Add source
          </Link>
        </div>
      )}
    </div>
  )
}

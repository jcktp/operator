'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, BookOpen } from 'lucide-react'
import LayoutD from '@/components/layouts/LayoutD'
import NewStoryModal from '@/components/journal/NewStoryModal'
import { AreaBadge } from '@/components/Badge'
import { cn, formatRelativeDate } from '@/lib/utils'

interface StoryRow {
  id: string           // projectId
  name: string
  storyStatus: string
  storyDescription: string | null
  area: string | null
  docCount: number
  attachedDocCount: number
  flagCount: number
  snippet: string | null
  updatedAt: string
}

interface ReportOption {
  id: string
  title: string
  area: string
}

const STATUS_DOT: Record<string, string> = {
  draft:   'bg-[var(--green)]',
  writing: 'bg-[var(--amber)]',
  filed:   'bg-[var(--text-muted)]',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', writing: 'Writing', filed: 'Filed',
}

export default function StoriesIndexClient({
  stories,
  allReports,
}: {
  stories: StoryRow[]
  allReports: ReportOption[]
}) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <LayoutD
        header={
          <div className="px-7 py-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Stories</h1>
              <p className="text-[var(--text-muted)] text-sm mt-0.5">
                {stories.length} {stories.length === 1 ? 'story' : 'stories'} — each story is its own workspace with documents, contacts, and a narrative draft.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full bg-[var(--ink)] text-[var(--ink-contrast)] hover:opacity-90 transition-colors disabled:opacity-40 shrink-0"
            >
              <Plus size={13} />
              New story
            </button>
          </div>
        }
      >
        {stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="w-12 h-12 bg-[var(--surface-2)] rounded-[10px] flex items-center justify-center mb-3">
              <BookOpen size={20} className="text-[var(--text-muted)]" />
            </div>
            <h2 className="text-base font-semibold text-[var(--text-bright)] mb-1.5">No stories yet</h2>
            <p className="text-sm text-[var(--text-muted)] max-w-sm leading-relaxed mb-4">
              Each story is a self-contained workspace — documents, contacts, analysis and your draft all in one place.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full bg-[var(--ink)] text-[var(--ink-contrast)] hover:opacity-90 transition-colors"
            >
              <Plus size={13} /> New story
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {stories.map(s => (
              <Link
                key={s.id}
                href={`/stories/${s.id}`}
                className="block bg-[var(--surface)] border border-[var(--border)] rounded-[10px] px-4 py-3.5 hover:border-[var(--border-mid)] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className={cn('w-1.5 h-1.5 rounded-full mt-2 shrink-0', STATUS_DOT[s.storyStatus] ?? STATUS_DOT.draft)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        {STATUS_LABELS[s.storyStatus] ?? 'Draft'}
                      </span>
                      {s.area && <AreaBadge area={s.area} />}
                      <span className="font-mono text-[10px] text-[var(--text-muted)] ml-auto">
                        {formatRelativeDate(s.updatedAt)}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-[var(--text-bright)] group-hover:text-[var(--blue)] transition-colors mb-1">
                      {s.name}
                    </h3>
                    {s.storyDescription && (
                      <p className="text-sm text-[var(--text-subtle)] line-clamp-1 mb-2">{s.storyDescription}</p>
                    )}
                    {s.snippet && (
                      <p className="text-[12px] text-[var(--text-muted)] line-clamp-2 mb-2 italic">{s.snippet}</p>
                    )}
                    <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--text-muted)]">
                      <span>{s.docCount} {s.docCount === 1 ? 'doc' : 'docs'}</span>
                      {s.attachedDocCount > 0 && s.attachedDocCount < s.docCount && (
                        <span>{s.attachedDocCount} in brief</span>
                      )}
                      {s.flagCount > 0 && (
                        <span className="text-[var(--red)]">⚑ {s.flagCount} {s.flagCount === 1 ? 'flag' : 'flags'}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </LayoutD>
      <NewStoryModal open={modalOpen} onClose={() => setModalOpen(false)} allReports={allReports} />
    </>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { Calendar, FileText, CheckCircle2, Clock, Pencil, Trash2, Loader2, ArrowRight, Radio, Share2, MessageSquare } from 'lucide-react'
import { AreaBadge } from '@/components/Badge'
import { formatRelativeDate } from '@/lib/utils'
import UnreadBadge from '@/components/collab/UnreadBadge'

interface Project {
  id: string
  name: string
  area: string
  startDate: string | null
  status: string
  description: string
  createdAt: string
  reportCount: number
  shareCount: number
}

interface Props {
  project: Project
  isActive: boolean
  projectLabel: string
  collabActive: boolean
  deletingId: string | null
  unreadCount: number
  onEdit: (p: Project) => void
  onDelete: (id: string) => void
  onOpenCollab: (id: string, tab: 'peers' | 'sync' | 'conflicts' | 'share' | 'chat') => void
  onGoToProject: (id: string) => void
}

export default function ProjectListItem({
  project: p, isActive, projectLabel, collabActive,
  deletingId, unreadCount, onEdit, onDelete, onOpenCollab, onGoToProject,
}: Props) {
  const router = useRouter()

  return (
    <div
      className={`group relative flex items-start gap-4 px-4 py-4 rounded-[10px] border transition-colors ${
        isActive
          ? 'border-indigo-300 bg-[var(--blue-dim)]/30'
          : 'border-[var(--border)] hover:border-[var(--border-mid)] bg-[var(--surface)]'
      }`}
    >
      <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-indigo-500' : 'bg-[var(--surface-3)]'}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-[var(--text-bright)]">{p.name}</span>
              {p.area && <AreaBadge area={p.area} />}
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded ${
                p.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {p.status === 'completed' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                {p.status === 'completed' ? 'Completed' : 'In progress'}
              </span>
              {isActive && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                  <Radio size={9} />
                  Active
                </span>
              )}
              {collabActive && p.shareCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-[var(--blue-dim)] text-[var(--blue)]">
                  <Share2 size={9} />
                  Shared · {p.shareCount} peer{p.shareCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {p.description && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">{p.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1"><FileText size={10} /> {p.reportCount} document{p.reportCount !== 1 ? 's' : ''}</span>
              {p.startDate && <span className="flex items-center gap-1"><Calendar size={10} /> Started {new Date(p.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
              <span>Created {formatRelativeDate(new Date(p.createdAt))}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {collabActive && (
              <>
                <button
                  onClick={() => onOpenCollab(p.id, 'chat')}
                  className="relative p-1.5 text-[var(--text-muted)] hover:text-[var(--blue)] hover:bg-[var(--blue-dim)] rounded transition-colors"
                  title="Project chat"
                >
                  <MessageSquare size={12} />
                  {unreadCount > 0 && (
                    <UnreadBadge count={unreadCount} className="absolute -top-0.5 -right-0.5" />
                  )}
                </button>
                <button
                  onClick={() => onOpenCollab(p.id, 'peers')}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--blue)] hover:bg-[var(--blue-dim)] rounded transition-colors"
                  title="Collaboration"
                >
                  <Share2 size={12} />
                </button>
              </>
            )}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(p)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)] rounded transition-colors"
                title={`Edit ${projectLabel}`}
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => onDelete(p.id)}
                disabled={deletingId === p.id}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--red)] hover:bg-red-50 rounded transition-colors"
                title={`Delete ${projectLabel}`}
              >
                {deletingId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isActive ? (
        <button
          onClick={() => router.push('/')}
          className="shrink-0 flex items-center gap-1 text-xs font-medium text-[var(--blue)] hover:text-indigo-800 transition-colors"
        >
          Go to overview <ArrowRight size={12} />
        </button>
      ) : (
        <button
          onClick={() => onGoToProject(p.id)}
          className="shrink-0 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--blue)] transition-colors"
          title="Set as active and go to overview"
        >
          Open <ArrowRight size={12} />
        </button>
      )}
    </div>
  )
}

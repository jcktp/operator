'use client'

import { ExternalLink, BookOpen, Loader2, X } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'

const TYPE_COLORS: Record<string, string> = {
 rss: 'bg-orange-50 text-orange-700 border-orange-200',
 reddit: 'bg-red-50 text-red-700 border-red-200',
 youtube: 'bg-red-50 text-red-800 border-red-300',
 bluesky: 'bg-sky-50 text-sky-700 border-sky-200',
 mastodon: 'bg-indigo-50 text-indigo-700 border-indigo-200',
 webhook: 'bg-purple-50 text-purple-700 border-purple-200',
}

interface PulseItem {
 id: string
 title: string
 url: string | null
 summary: string | null
 publishedAt: string | null
 savedToJournal: boolean
 feedId: string
}

interface Props {
 item: PulseItem & { feedName: string; feedType: string }
 isKeywordMode: boolean
 activeKeywords: Set<string>
 savingItemId: string | null
 savingFolder: Record<string, string>
 setSavingFolder: React.Dispatch<React.SetStateAction<Record<string, string>>>
 onSave: (id: string, folder?: string) => void
 onUnsave: (id: string) => void
}

function highlight(text: string, activeKeywords: Set<string>): React.ReactNode {
 if (activeKeywords.size === 0) return text
 const pattern = new RegExp(`(${[...activeKeywords].map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
 const parts = text.split(pattern)
 return parts.map((part, i) =>
 pattern.test(part) ? <mark key={i} className="bg-amber-100 text-amber-900 rounded px-0.5">{part}</mark> : part
 )
}

export default function PulseItemCard({ item, isKeywordMode, activeKeywords, savingItemId, savingFolder, setSavingFolder, onSave, onUnsave }: Props) {
 const showHighlight = isKeywordMode && activeKeywords.size > 0

 return (
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
 <div className="flex items-start justify-between gap-3">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1.5 flex-wrap">
 <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${TYPE_COLORS[item.feedType] ?? 'bg-[var(--surface-2)] text-[var(--text-subtle)] border-[var(--border)]'}`}>
 {item.feedName}
 </span>
 {item.publishedAt && (
 <span className="text-xs text-[var(--text-muted)]">{formatRelativeDate(item.publishedAt)}</span>
 )}
 </div>
 <p className="text-sm font-medium leading-snug text-[var(--text-bright)]">
 {showHighlight ? highlight(item.title, activeKeywords) : item.title}
 </p>
 {item.summary && item.summary !== item.title && (
 <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
 {showHighlight ? highlight(item.summary, activeKeywords) : item.summary}
 </p>
 )}
 </div>

 <div className="flex items-center gap-1.5 shrink-0">
 {item.url && (
 <a
 href={item.url}
 target="_blank"
 rel="noopener noreferrer"
 className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-body)] rounded hover:bg-[var(--surface-2)]"
 title="Open in browser"
 >
 <ExternalLink size={13} />
 </a>
 )}
 {item.savedToJournal ? (
 <div className="flex items-center gap-1">
 <a href="/journal?folder=Pulse"
 className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border border-[var(--green)] text-[var(--green)] bg-[var(--green-dim)] hover:bg-green-100 transition-colors"
 title="Saved to Journal — click to view"
 >
 <BookOpen size={11} />
 Saved
 </a>
 <button
 onClick={() => onUnsave(item.id)}
 disabled={savingItemId === item.id}
 className="p-1 rounded text-[var(--border)] hover:text-[var(--red)] hover:bg-red-50 transition-colors"
 title="Remove from Journal"
 >
 {savingItemId === item.id ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
 </button>
 </div>
 ) : isKeywordMode ? (
 <div className="flex items-center gap-1">
 <input
 type="text"
 value={savingFolder[item.id] ?? 'Pulse'}
 onChange={e => setSavingFolder(sf => ({ ...sf, [item.id]: e.target.value }))}
 placeholder="Folder"
 className="w-20 text-xs border border-[var(--border)] rounded px-1.5 py-0.5 focus:outline-none focus:ring-1"
 />
 <button
 onClick={() => onSave(item.id, savingFolder[item.id])}
 disabled={savingItemId === item.id}
 className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors"
 title="Save to Journal"
 >
 {savingItemId === item.id ? <Loader2 size={11} className="animate-spin" /> : <BookOpen size={11} />}
 Save
 </button>
 </div>
 ) : (
 <button
 onClick={() => onSave(item.id)}
 disabled={savingItemId === item.id}
 className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors"
 title="Save to Journal"
 >
 {savingItemId === item.id ? <Loader2 size={11} className="animate-spin" /> : <BookOpen size={11} />}
 Save
 </button>
 )}
 </div>
 </div>
 </div>
 )
}

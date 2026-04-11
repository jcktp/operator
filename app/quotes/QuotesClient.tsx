'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, Quote } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuoteItem {
 id: string; text: string; speaker: string | null; context: string | null
 sourceType: string; tags: string[]; reportId: string | null
 projectId: string | null; createdAt: string
}

const SOURCE_TYPES = ['interview', 'survey', 'focus_group', 'document'] as const
const SOURCE_LABEL: Record<string, string> = {
 interview: 'Interview', survey: 'Survey', focus_group: 'Focus group', document: 'Document',
}
const SOURCE_COLOR: Record<string, string> = {
 interview: 'bg-blue-50 text-blue-700',
 survey: 'bg-violet-50 text-violet-700',
 focus_group: 'bg-amber-50 text-amber-700',
 document: 'bg-[var(--surface-2)] text-[var(--text-subtle)]',
}

const inputCls = 'w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30'

export default function QuotesClient() {
 const [quotes, setQuotes] = useState<QuoteItem[]>([])
 const [loading, setLoading] = useState(true)
 const [showForm, setShowForm] = useState(false)
 const [filter, setFilter] = useState('all')
 const [search, setSearch] = useState('')

 const [fText, setFText] = useState('')
 const [fSpeaker, setFSpeaker] = useState('')
 const [fContext, setFContext] = useState('')
 const [fSourceType, setFSourceType] = useState<string>('interview')
 const [fTags, setFTags] = useState('')
 const [saving, setSaving] = useState(false)

 const load = useCallback(async () => {
 setLoading(true)
 try {
 const res = await fetch('/api/quotes')
 if (res.ok) {
 const d = await res.json() as { quotes: QuoteItem[] }
 setQuotes(d.quotes)
 }
 } catch { /* silent */ } finally { setLoading(false) }
 }, [])

 useEffect(() => { void load() }, [load])

 const handleCreate = async () => {
 if (!fText.trim()) return
 setSaving(true)
 try {
 const tags = fTags.split(',').map(t => t.trim()).filter(Boolean)
 const res = await fetch('/api/quotes', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ text: fText, speaker: fSpeaker, context: fContext, sourceType: fSourceType, tags }),
 })
 if (res.ok) {
 const d = await res.json() as { quote: QuoteItem }
 setQuotes(prev => [d.quote, ...prev])
 setFText(''); setFSpeaker(''); setFContext(''); setFSourceType('interview'); setFTags(''); setShowForm(false)
 }
 } catch { /* silent */ } finally { setSaving(false) }
 }

 const handleDelete = async (id: string) => {
 setQuotes(prev => prev.filter(q => q.id !== id))
 await fetch(`/api/quotes/${id}`, { method: 'DELETE' }).catch(() => {})
 }

 const visible = quotes.filter(q => {
 if (filter !== 'all' && q.sourceType !== filter) return false
 if (search && !q.text.toLowerCase().includes(search.toLowerCase()) &&
 !q.speaker?.toLowerCase().includes(search.toLowerCase()) &&
 !q.context?.toLowerCase().includes(search.toLowerCase())) return false
 return true
 })

 if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={18} className="animate-spin text-[var(--text-muted)]" /></div>

 return (
 <div className="max-w-3xl space-y-5">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Quote Bank</h1>
 <p className="text-sm text-[var(--text-muted)] mt-0.5">{quotes.length} verbatim quote{quotes.length !== 1 ? 's' : ''} collected across your research.</p>
 </div>
 <button onClick={() => setShowForm(v => !v)}
 className="flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] text-xs font-medium bg-[var(--ink)] text-white hover:bg-[var(--ink)] transition-colors">
 <Plus size={14} /> Add quote
 </button>
 </div>

 <div className="flex gap-2 flex-wrap items-center">
 <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotes…"
 className="border border-[var(--border)] rounded-[4px] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 w-48" />
 <div className="flex gap-1.5 flex-wrap">
 {(['all', ...SOURCE_TYPES] as const).map(s => (
 <button key={s} onClick={() => setFilter(s)}
 className={cn('h-6 px-2.5 rounded-[4px] text-[11px] font-medium border transition-colors',
 filter === s ? 'bg-[var(--ink)] text-white border-transparent' : 'border-[var(--border)] text-[var(--text-muted)]')}>
 {s === 'all' ? `All (${quotes.length})` : SOURCE_LABEL[s]}
 </button>
 ))}
 </div>
 </div>

 {showForm && (
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-3">
 <h2 className="text-sm font-semibold text-[var(--text-bright)]">Add Quote</h2>
 <textarea value={fText} onChange={e => setFText(e.target.value)} rows={3}
 placeholder="The exact verbatim quote *" className={cn(inputCls, 'resize-none')} />
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Speaker</label>
 <input value={fSpeaker} onChange={e => setFSpeaker(e.target.value)} placeholder="Who said this?" className={inputCls} />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Source type</label>
 <select value={fSourceType} onChange={e => setFSourceType(e.target.value)} className={inputCls}>
 {SOURCE_TYPES.map(t => <option key={t} value={t}>{SOURCE_LABEL[t]}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Context</label>
 <input value={fContext} onChange={e => setFContext(e.target.value)} placeholder="Study name, date, topic" className={inputCls} />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Tags (comma separated)</label>
 <input value={fTags} onChange={e => setFTags(e.target.value)} placeholder="price sensitivity, onboarding…" className={inputCls} />
 </div>
 </div>
 <div className="flex gap-2 pt-1">
 <button onClick={handleCreate} disabled={saving || !fText.trim()}
 className="h-7 px-3 rounded-[4px] text-xs font-medium bg-[var(--ink)] text-white hover:bg-[var(--ink)] transition-colors disabled:opacity-50 flex items-center gap-2">
 {saving && <Loader2 size={13} className="animate-spin" />} Add
 </button>
 <button onClick={() => setShowForm(false)} className="h-7 px-3 rounded-[4px] text-xs font-medium border border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--surface-2)] transition-colors">Cancel</button>
 </div>
 </div>
 )}

 {visible.length === 0 ? (
 <div className="text-center py-12 text-[var(--text-muted)] text-sm">No quotes found.</div>
 ) : (
 <div className="space-y-3">
 {visible.map(q => (
 <div key={q.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
 <div className="flex gap-3">
 <Quote size={16} className="shrink-0 mt-1 text-indigo-400" />
 <div className="flex-1 min-w-0 space-y-2">
 <p className="text-sm text-[var(--text-body)] leading-relaxed italic">&ldquo;{q.text}&rdquo;</p>
 <div className="flex items-center gap-2 flex-wrap">
 {q.speaker && <span className="text-[11px] font-medium text-[var(--text-subtle)]">— {q.speaker}</span>}
 {q.context && <span className="text-[11px] text-[var(--text-muted)]">{q.context}</span>}
 <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', SOURCE_COLOR[q.sourceType])}>
 {SOURCE_LABEL[q.sourceType]}
 </span>
 {q.tags.map(tag => (
 <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-muted)]">
 {tag}
 </span>
 ))}
 </div>
 </div>
 <button onClick={() => void handleDelete(q.id)} className="text-[var(--border)] hover:text-[var(--red)] transition-colors shrink-0">
 <Trash2 size={13} />
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )
}

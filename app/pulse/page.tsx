'use client'

import { Rss, Plus, Trash2, RefreshCw, Loader2, ChevronDown, Pencil, Check, Globe, ChevronLeft, ChevronRight, Eraser, Tag, X } from 'lucide-react'
import { formatRelativeDate, cn } from '@/lib/utils'
import { useMode } from '@/components/ModeContext'
import { RefreshDropdown, TypeDropdown } from './PulseDropdowns'
import PulseItemCard from './PulseItemCard'
import PulseAddFeedForm from './PulseAddFeedForm'
import PulseFeedDirectory from './PulseFeedDirectory'
import { usePulseFeeds } from './usePulseFeeds'

export default function PulsePage() {
 const modeConfig = useMode()
 const { keywordMonitoring: isKeywordMode, defaultFeeds: hasDefaultFeeds } = modeConfig.features
 const p = usePulseFeeds(hasDefaultFeeds)

 if (p.loading) {
 return (
 <div className="flex items-center justify-center min-h-[40vh]">
 <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
 </div>
 )
 }

 return (
 <div className="flex flex-col h-full pb-4">
 {/* Fixed header */}
 <div className="shrink-0 pt-2 pb-4">
 <div className="flex items-start justify-between">
 <div>
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Pulse</h1>
 <p className="text-[var(--text-muted)] text-sm mt-0.5">
 Live feeds — RSS, Reddit, YouTube, Bluesky, Mastodon, and webhooks.
 </p>
 {p.lastAutoRefresh && (
 <p className="text-xs text-[var(--text-muted)] mt-0.5">
 {p.autoRefreshing
 ? <span className="flex items-center gap-1"><RefreshCw size={10} className="animate-spin" /> Refreshing…</span>
 : `Auto-refreshed ${formatRelativeDate(p.lastAutoRefresh.toISOString())}`}
 </p>
 )}
 </div>
 <div className="flex items-center gap-2">
 <div className="flex items-center gap-1.5">
 <button
 onClick={p.refreshAll}
 disabled={p.autoRefreshing}
 title="Refresh all feeds"
 className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40"
 >
 <RefreshCw size={14} className={p.autoRefreshing ? 'animate-spin' : ''} />
 </button>
 <RefreshDropdown value={p.autoRefreshMinutes} onChange={p.setAutoRefreshMinutes} />
 </div>
 <button
 onClick={() => { p.setShowDirectory(s => !s); p.setShowAdd(false) }}
 className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-[4px] border transition-colors ${
 p.showDirectory
 ? 'bg-[var(--surface-2)] text-[var(--text-body)] border-[var(--border)]'
 : 'bg-[var(--surface)] text-[var(--text-body)] border-[var(--border)] hover:bg-[var(--surface-2)]'
 }`}
 >
 <Globe size={14} />
 Browse directory
 </button>
 <button
 onClick={() => { p.setShowAdd(s => !s); p.setShowDirectory(false) }}
 className="inline-flex items-center gap-1.5 bg-[var(--ink)] text-white text-sm font-medium px-3 py-1.5 rounded-[4px] hover:bg-[var(--ink)] transition-colors"
 >
 {p.showAdd ? <X size={14} /> : <Plus size={14} />}
 {p.showAdd ? 'Cancel' : 'Add feed'}
 </button>
 </div>
 </div>

 {/* Keyword monitoring — fixed, does not scroll */}
 {isKeywordMode && (
 <div className="mt-4 bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4 space-y-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Tag size={13} className="text-[var(--text-muted)]" />
 <span className="text-sm font-medium text-[var(--text-body)]">Keyword monitoring</span>
 {p.activeKeywords.size > 0 && (
 <button
 onClick={() => p.setActiveKeywords(new Set())}
 className="text-xs px-2 py-0.5 rounded-[4px] border border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
 >
 Clear filter
 </button>
 )}
 </div>
 <span className="text-xs text-[var(--text-muted)]">{p.keywords.length} keyword{p.keywords.length !== 1 ? 's' : ''}</span>
 </div>
 <form
 onSubmit={e => {
 e.preventDefault()
 const kw = p.keywordInput.trim()
 if (kw && !p.keywords.includes(kw)) p.setKeywords(ks => [...ks, kw])
 p.setKeywordInput('')
 }}
 className="flex gap-2"
 >
 <input
 type="text"
 value={p.keywordInput}
 onChange={e => p.setKeywordInput(e.target.value)}
 placeholder="Add keyword (e.g. climate, corruption)…"
 className="flex-1 border border-[var(--border)] rounded-[4px] px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
 />
 <button
 type="submit"
 disabled={!p.keywordInput.trim()}
 className="text-sm font-medium px-3 py-1.5 rounded-[4px] border border-[var(--border)] text-[var(--text-body)] hover:bg-[var(--surface-2)] disabled:opacity-40"
 >
 Add
 </button>
 </form>
 {p.keywords.length > 0 && (
 <div className="flex flex-wrap gap-1.5">
 {p.keywords.map(kw => {
 const active = p.activeKeywords.has(kw)
 return (
 <span
 key={kw}
 className={cn(
 'flex items-center gap-1 text-xs px-2 py-0.5 rounded-[4px] border cursor-pointer select-none transition-colors',
 active
 ? 'bg-amber-100 border-amber-300 text-amber-900'
 : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-body)] hover:bg-[var(--surface-3)]'
 )}
 onClick={() => p.setActiveKeywords(s => {
 const n = new Set(s)
 n.has(kw) ? n.delete(kw) : n.add(kw)
 return n
 })}
 >
 {kw}
 <button
 onClick={e => {
 e.stopPropagation()
 p.setKeywords(ks => ks.filter(k => k !== kw))
 p.setActiveKeywords(s => { const n = new Set(s); n.delete(kw); return n })
 }}
 className="text-[var(--text-muted)] hover:text-[var(--text-body)]"
 >
 <X size={10} />
 </button>
 </span>
 )
 })}
 </div>
 )}
 </div>
 )}

 {/* Add feed / directory panels — fixed */}
 {p.showAdd && (
 <div className="mt-4">
 <PulseAddFeedForm
 form={p.form}
 setForm={p.setForm}
 onSubmit={p.handleAdd}
 adding={p.adding}
 bskyConfigured={p.bskyConfigured}
 />
 </div>
 )}
 {p.showDirectory && (
 <div className="mt-4">
 <PulseFeedDirectory
 existingUrls={p.existingUrls}
 dirCategory={p.dirCategory}
 setDirCategory={p.setDirCategory}
 addingFromDir={p.addingFromDir}
 onAdd={p.handleAddFromDir}
 />
 </div>
 )}
 </div>

 {/* Scrollable feed area */}
 {p.feeds.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-20 text-center">
 <div className="w-12 h-12 bg-[var(--surface-2)] rounded-[10px] flex items-center justify-center mb-4">
 <Rss size={20} className="text-[var(--text-muted)]" />
 </div>
 <p className="text-sm text-[var(--text-muted)]">No feeds yet.</p>
 <p className="text-xs text-[var(--text-muted)] mt-1">Add RSS, Reddit, YouTube, Bluesky, or Mastodon feeds.</p>
 </div>
 ) : (
 <div className="flex-1 min-h-0 flex gap-6">
 {/* Sidebar — scrolls independently */}
 <aside className="w-56 shrink-0 overflow-y-auto space-y-1 pr-1">
 <button
 onClick={() => { p.setActiveFeed(null); p.setPage(1) }}
 className={`w-full flex items-center justify-between h-7 px-2.5 rounded-[4px] text-sm transition-colors ${
 p.activeFeed === null ? 'bg-[var(--ink)] text-white font-medium' : 'text-[var(--text-subtle)] hover:bg-[var(--surface-2)]'
 }`}
 >
 <span>All feeds</span>
 <span className={`text-xs ${p.activeFeed === null ? 'text-[var(--border)]' : 'text-[var(--text-muted)]'}`}>{p.allItems.length}</span>
 </button>

 {p.feeds.map(f => (
 <div key={f.id}>
 {p.editingId === f.id ? (
 <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[4px] p-2.5 space-y-2">
 <input
 autoFocus
 value={p.editForm.name}
 onChange={e => p.setEditForm(ef => ({ ...ef, name: e.target.value }))}
 className="w-full border border-[var(--border)] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1"
 placeholder="Feed name"
 />
 <input
 value={p.editForm.url}
 onChange={e => p.setEditForm(ef => ({ ...ef, url: e.target.value }))}
 className="w-full border border-[var(--border)] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1"
 placeholder="URL / username"
 />
 <TypeDropdown value={p.editForm.type} onChange={v => p.setEditForm(ef => ({ ...ef, type: v }))} compact />
 <div className="flex gap-1.5">
 <button
 type="button"
 disabled={p.savingEdit}
 onClick={() => p.handleSaveEdit(f.id)}
 className="flex-1 flex items-center justify-center gap-1 bg-[var(--ink)] text-white text-xs font-medium py-1 rounded hover:bg-[var(--ink)] disabled:opacity-50"
 >
 {p.savingEdit ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
 Save
 </button>
 <button
 type="button"
 onClick={() => p.setEditingId(null)}
 className="flex-1 text-xs text-[var(--text-muted)] py-1 rounded border border-[var(--border)] hover:bg-[var(--surface-2)]"
 >
 Cancel
 </button>
 </div>
 </div>
 ) : (
 <div className="group relative">
 <button
 onClick={() => { p.setActiveFeed(f.id === p.activeFeed ? null : f.id); p.setEditingId(null); p.setPage(1) }}
 className={`w-full flex items-center justify-between h-7 px-2.5 rounded-[4px] text-sm transition-colors ${
 p.activeFeed === f.id ? 'bg-[var(--ink)] text-white font-medium' : 'text-[var(--text-subtle)] hover:bg-[var(--surface-2)]'
 }`}
 >
 <span className="truncate text-left">{f.name}</span>
 <span className={`text-xs shrink-0 ml-1 ${p.activeFeed === f.id ? 'text-[var(--border)]' : 'text-[var(--text-muted)]'}`}>
 {f.items.length}
 </span>
 </button>

 {p.refreshError?.id === f.id && (
 <p className="text-[10px] text-[var(--red)] px-3 pb-1 leading-snug">{p.refreshError.message}</p>
 )}

 <div className="absolute right-1 top-1 hidden group-hover:flex items-center gap-0.5 bg-[var(--surface)]/90/90 rounded">
 <button
 onClick={() => p.handleRefresh(f.id)}
 disabled={p.refreshingId === f.id}
 className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-body)]"
 title="Refresh"
 >
 <RefreshCw size={11} className={p.refreshingId === f.id ? 'animate-spin' : ''} />
 </button>
 <button
 onClick={() => p.startEdit(f)}
 className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-body)]"
 title="Edit"
 >
 <Pencil size={11} />
 </button>
 <button
 onClick={() => p.handleClearFeed(f.id)}
 className={`p-1 rounded ${p.clearingId === f.id ? 'text-[var(--amber)] bg-[var(--amber-dim)]' : 'text-[var(--text-muted)] hover:text-amber-500 hover:bg-[var(--surface-2)]'}`}
 title={p.clearingId === f.id ? 'Click again to clear all items' : 'Clear feed items'}
 >
 <Eraser size={11} />
 </button>
 <button
 onClick={() => p.handleDelete(f.id)}
 className={`p-1 rounded ${p.deletingId === f.id ? 'text-[var(--red)] bg-[var(--red-dim)]' : 'text-[var(--text-muted)] hover:text-[var(--red)] hover:bg-[var(--surface-2)]'}`}
 title={p.deletingId === f.id ? 'Click again to confirm delete' : 'Delete feed'}
 >
 <Trash2 size={11} />
 </button>
 </div>
 </div>
 )}
 </div>
 ))}
 </aside>

 {/* Main timeline — scrolls independently */}
 <div className="flex-1 min-w-0 overflow-y-auto pr-1">
 {p.allItems.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-center">
 <p className="text-sm text-[var(--text-muted)]">No items yet.</p>
 <p className="text-xs text-[var(--text-muted)] mt-1">Refresh a feed to load items.</p>
 </div>
 ) : (
 <div className="space-y-3 pb-4">
 {p.allItems.slice((p.page - 1) * p.ITEMS_PER_PAGE, p.page * p.ITEMS_PER_PAGE).map(item => (
 <PulseItemCard
 key={item.id}
 item={item}
 isKeywordMode={isKeywordMode}
 activeKeywords={p.activeKeywords}
 savingItemId={p.savingItemId}
 savingFolder={p.savingFolder}
 setSavingFolder={p.setSavingFolder}
 onSave={p.handleSaveToJournal}
 onUnsave={p.handleUnsaveFromJournal}
 />
 ))}

 {p.allItems.length > p.ITEMS_PER_PAGE && (
 <div className="flex items-center justify-between pt-2">
 <span className="text-xs text-[var(--text-muted)]">
 {(p.page - 1) * p.ITEMS_PER_PAGE + 1}–{Math.min(p.page * p.ITEMS_PER_PAGE, p.allItems.length)} of {p.allItems.length}
 </span>
 <div className="flex items-center gap-1">
 <button
 onClick={() => p.setPage(n => Math.max(1, n - 1))}
 disabled={p.page === 1}
 className="p-1.5 rounded-[4px] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-default transition-colors"
 >
 <ChevronLeft size={13} />
 </button>
 <span className="text-xs text-[var(--text-subtle)] px-2">Page {p.page} of {Math.ceil(p.allItems.length / p.ITEMS_PER_PAGE)}</span>
 <button
 onClick={() => p.setPage(n => Math.min(Math.ceil(p.allItems.length / p.ITEMS_PER_PAGE), n + 1))}
 disabled={p.page >= Math.ceil(p.allItems.length / p.ITEMS_PER_PAGE)}
 className="p-1.5 rounded-[4px] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-default transition-colors"
 >
 <ChevronRight size={13} />
 </button>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 )
}

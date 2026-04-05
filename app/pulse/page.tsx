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
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full pb-4">
      {/* Fixed header */}
      <div className="shrink-0 pt-2 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">Pulse</h1>
            <p className="text-gray-500 dark:text-zinc-400 text-sm mt-0.5">
              Live feeds — RSS, Reddit, YouTube, Bluesky, Mastodon, and webhooks.
            </p>
            {p.lastAutoRefresh && (
              <p className="text-xs text-gray-400 mt-0.5">
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
                className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
              >
                <RefreshCw size={14} className={p.autoRefreshing ? 'animate-spin' : ''} />
              </button>
              <RefreshDropdown value={p.autoRefreshMinutes} onChange={p.setAutoRefreshMinutes} />
            </div>
            <button
              onClick={() => { p.setShowDirectory(s => !s); p.setShowAdd(false) }}
              className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                p.showDirectory
                  ? 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 border-gray-200 dark:border-zinc-700'
                  : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-200 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800'
              }`}
            >
              <Globe size={14} />
              Browse directory
            </button>
            <button
              onClick={() => { p.setShowAdd(s => !s); p.setShowDirectory(false) }}
              className="inline-flex items-center gap-1.5 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors"
            >
              {p.showAdd ? <X size={14} /> : <Plus size={14} />}
              {p.showAdd ? 'Cancel' : 'Add feed'}
            </button>
          </div>
        </div>

        {/* Keyword monitoring — fixed, does not scroll */}
        {isKeywordMode && (
          <div className="mt-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag size={13} className="text-gray-400 dark:text-zinc-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-zinc-200">Keyword monitoring</span>
                {p.activeKeywords.size > 0 && (
                  <button
                    onClick={() => p.setActiveKeywords(new Set())}
                    className="text-xs px-2 py-0.5 rounded-full border border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                  >
                    Clear filter
                  </button>
                )}
              </div>
              <span className="text-xs text-gray-400 dark:text-zinc-500">{p.keywords.length} keyword{p.keywords.length !== 1 ? 's' : ''}</span>
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
                className="flex-1 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              />
              <button
                type="submit"
                disabled={!p.keywordInput.trim()}
                className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-40"
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
                        'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border cursor-pointer select-none transition-colors',
                        active
                          ? 'bg-amber-100 dark:bg-amber-900 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100'
                          : 'bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-700'
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
                        className="text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200"
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
          <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center mb-4">
            <Rss size={20} className="text-gray-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm text-gray-500 dark:text-zinc-400">No feeds yet.</p>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Add RSS, Reddit, YouTube, Bluesky, or Mastodon feeds.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex gap-6">
          {/* Sidebar — scrolls independently */}
          <aside className="w-56 shrink-0 overflow-y-auto space-y-1 pr-1">
            <button
              onClick={() => { p.setActiveFeed(null); p.setPage(1) }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                p.activeFeed === null ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium' : 'text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
              }`}
            >
              <span>All feeds</span>
              <span className={`text-xs ${p.activeFeed === null ? 'text-gray-300 dark:text-zinc-600' : 'text-gray-400 dark:text-zinc-500'}`}>{p.allItems.length}</span>
            </button>

            {p.feeds.map(f => (
              <div key={f.id}>
                {p.editingId === f.id ? (
                  <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 space-y-2">
                    <input
                      autoFocus
                      value={p.editForm.name}
                      onChange={e => p.setEditForm(ef => ({ ...ef, name: e.target.value }))}
                      className="w-full border border-gray-200 dark:border-zinc-700 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-700 dark:text-zinc-100"
                      placeholder="Feed name"
                    />
                    <input
                      value={p.editForm.url}
                      onChange={e => p.setEditForm(ef => ({ ...ef, url: e.target.value }))}
                      className="w-full border border-gray-200 dark:border-zinc-700 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-700 dark:text-zinc-100"
                      placeholder="URL / username"
                    />
                    <TypeDropdown value={p.editForm.type} onChange={v => p.setEditForm(ef => ({ ...ef, type: v }))} compact />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={p.savingEdit}
                        onClick={() => p.handleSaveEdit(f.id)}
                        className="flex-1 flex items-center justify-center gap-1 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium py-1 rounded hover:bg-gray-800 dark:hover:bg-zinc-200 disabled:opacity-50"
                      >
                        {p.savingEdit ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => p.setEditingId(null)}
                        className="flex-1 text-xs text-gray-500 dark:text-zinc-400 py-1 rounded border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group relative">
                    <button
                      onClick={() => { p.setActiveFeed(f.id === p.activeFeed ? null : f.id); p.setEditingId(null); p.setPage(1) }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        p.activeFeed === f.id ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium' : 'text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className="truncate text-left">{f.name}</span>
                      <span className={`text-xs shrink-0 ml-1 ${p.activeFeed === f.id ? 'text-gray-300 dark:text-zinc-600' : 'text-gray-400 dark:text-zinc-500'}`}>
                        {f.items.length}
                      </span>
                    </button>

                    {p.refreshError?.id === f.id && (
                      <p className="text-[10px] text-red-500 px-3 pb-1 leading-snug">{p.refreshError.message}</p>
                    )}

                    <div className="absolute right-1 top-1 hidden group-hover:flex items-center gap-0.5 bg-white/90 dark:bg-zinc-900/90 rounded">
                      <button
                        onClick={() => p.handleRefresh(f.id)}
                        disabled={p.refreshingId === f.id}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200"
                        title="Refresh"
                      >
                        <RefreshCw size={11} className={p.refreshingId === f.id ? 'animate-spin' : ''} />
                      </button>
                      <button
                        onClick={() => p.startEdit(f)}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200"
                        title="Edit"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => p.handleClearFeed(f.id)}
                        className={`p-1 rounded ${p.clearingId === f.id ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950' : 'text-gray-400 dark:text-zinc-500 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
                        title={p.clearingId === f.id ? 'Click again to clear all items' : 'Clear feed items'}
                      >
                        <Eraser size={11} />
                      </button>
                      <button
                        onClick={() => p.handleDelete(f.id)}
                        className={`p-1 rounded ${p.deletingId === f.id ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950' : 'text-gray-400 dark:text-zinc-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
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
                <p className="text-sm text-gray-500 dark:text-zinc-400">No items yet.</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Refresh a feed to load items.</p>
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
                    <span className="text-xs text-gray-400 dark:text-zinc-500">
                      {(p.page - 1) * p.ITEMS_PER_PAGE + 1}–{Math.min(p.page * p.ITEMS_PER_PAGE, p.allItems.length)} of {p.allItems.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => p.setPage(n => Math.max(1, n - 1))}
                        disabled={p.page === 1}
                        className="p-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-default transition-colors"
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <span className="text-xs text-gray-600 dark:text-zinc-300 px-2">Page {p.page} of {Math.ceil(p.allItems.length / p.ITEMS_PER_PAGE)}</span>
                      <button
                        onClick={() => p.setPage(n => Math.min(Math.ceil(p.allItems.length / p.ITEMS_PER_PAGE), n + 1))}
                        disabled={p.page >= Math.ceil(p.allItems.length / p.ITEMS_PER_PAGE)}
                        className="p-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-default transition-colors"
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

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Rss, Plus, Trash2, RefreshCw, Loader2, ChevronDown, Pencil, Check, Globe, ChevronLeft, ChevronRight, Eraser, Tag, X } from 'lucide-react'
import { formatRelativeDate, cn } from '@/lib/utils'
import { useMode } from '@/components/ModeContext'
import { useSettings } from '@/lib/use-settings'
import { RefreshDropdown, TypeDropdown } from './PulseDropdowns'
import PulseItemCard from './PulseItemCard'
import PulseAddFeedForm from './PulseAddFeedForm'
import PulseFeedDirectory from './PulseFeedDirectory'

interface PulseItem {
  id: string
  title: string
  url: string | null
  summary: string | null
  publishedAt: string | null
  savedToJournal: boolean
  feedId: string
}

interface PulseFeed {
  id: string
  name: string
  url: string
  type: string
  enabled: boolean
  lastFetched: string | null
  items: PulseItem[]
}

export default function PulsePage() {
  const modeConfig = useMode()
  const { keywordMonitoring: isKeywordMode, defaultFeeds: hasDefaultFeeds } = modeConfig.features
  const [feeds, setFeeds] = useState<PulseFeed[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [activeFeed, setActiveFeed] = useState<string | null>(null)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<{ id: string; message: string } | null>(null)
  const [savingItemId, setSavingItemId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', url: '', type: 'rss' })
  const { settings } = useSettings()
  const bskyConfigured = !!(settings.bluesky_identifier && settings.bluesky_app_password)
  const [adding, setAdding] = useState(false)
  // Clear feed state
  const [clearingId, setClearingId] = useState<string | null>(null)
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', url: '', type: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  // Directory
  const [showDirectory, setShowDirectory] = useState(false)
  const [dirCategory, setDirCategory] = useState('All')
  const [addingFromDir, setAddingFromDir] = useState<Set<string>>(new Set())
  // Auto-refresh
  const [autoRefreshMinutes, setAutoRefreshMinutes] = useState<number>(() => {
    if (typeof window !== 'undefined') return parseInt(localStorage.getItem('pulse_autorefresh') ?? '0') || 0
    return 0
  })
  const [autoRefreshing, setAutoRefreshing] = useState(false)
  const [lastAutoRefresh, setLastAutoRefresh] = useState<Date | null>(null)
  const feedsRef = useRef<PulseFeed[]>([])
  // Pagination
  const [page, setPage] = useState(1)
  const ITEMS_PER_PAGE = 20
  // Journalism: keyword monitoring
  const [keywords, setKeywords] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('pulse_keywords') ?? '[]') } catch { return [] }
  })
  const [keywordInput, setKeywordInput] = useState('')
  const [activeKeywords, setActiveKeywords] = useState<Set<string>>(new Set())
  // Journalism: folder picker for save
  const [savingFolder, setSavingFolder] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const res = await fetch('/api/pulse')
    const data = await res.json() as { feeds: PulseFeed[] }
    const feeds = data.feeds ?? []
    setFeeds(feeds)
    feedsRef.current = feeds
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Init mode-specific default feeds on first visit
  useEffect(() => {
    if (!hasDefaultFeeds) return
    fetch('/api/pulse/init-journalism', { method: 'POST' })
      .then(r => r.json())
      .then((d: { created?: number }) => { if ((d.created ?? 0) > 0) load() })
      .catch(() => {})
  }, [hasDefaultFeeds, load])

  // Persist keywords to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pulse_keywords', JSON.stringify(keywords))
    }
  }, [keywords])

  const refreshAll = useCallback(async () => {
    const enabled = feedsRef.current.filter(f => f.enabled)
    if (!enabled.length) return
    setAutoRefreshing(true)
    for (const f of enabled) {
      await fetch(`/api/pulse/${f.id}`, { method: 'POST' }).catch(() => {})
    }
    setAutoRefreshing(false)
    setLastAutoRefresh(new Date())
    await load()
  }, [load])

  // Auto-refresh interval
  useEffect(() => {
    localStorage.setItem('pulse_autorefresh', String(autoRefreshMinutes))
    if (!autoRefreshMinutes) return
    const ms = autoRefreshMinutes * 60 * 1000
    const id = setInterval(refreshAll, ms)
    return () => clearInterval(id)
  }, [autoRefreshMinutes, refreshAll])

  const matchesKeywords = (item: PulseItem) => {
    if (activeKeywords.size === 0) return false
    const haystack = `${item.title} ${item.summary ?? ''}`.toLowerCase()
    return [...activeKeywords].some(kw => haystack.includes(kw.toLowerCase()))
  }

  const highlightKeywords = (text: string): React.ReactNode => {
    if (activeKeywords.size === 0) return text
    const pattern = new RegExp(`(${[...activeKeywords].map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
    const parts = text.split(pattern)
    return parts.map((part, i) =>
      pattern.test(part) ? <mark key={i} className="bg-amber-100 text-amber-900 rounded px-0.5">{part}</mark> : part
    )
  }

  const baseItems: (PulseItem & { feedName: string; feedType: string })[] = feeds
    .filter(f => f.enabled && (activeFeed === null || f.id === activeFeed))
    .flatMap(f => f.items.map(i => ({ ...i, feedName: f.name, feedType: f.type })))
    .sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
      return tb - ta
    })

  const allItems = activeKeywords.size > 0
    ? baseItems.filter(item => matchesKeywords(item))
    : baseItems

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.url) return
    setAdding(true)
    await fetch('/api/pulse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ name: '', url: '', type: 'rss' })
    setShowAdd(false)
    setAdding(false)
    await load()
  }

  const existingUrls = new Set(feeds.map(f => f.url))

  const handleAddFromDir = async (name: string, url: string) => {
    setAddingFromDir(s => new Set(s).add(url))
    await fetch('/api/pulse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url, type: 'rss' }),
    })
    await load()
    setAddingFromDir(s => { const n = new Set(s); n.delete(url); return n })
  }

  const handleRefresh = async (id: string) => {
    setRefreshingId(id)
    setRefreshError(null)
    const res = await fetch(`/api/pulse/${id}`, { method: 'POST' })
    setRefreshingId(null)
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      setRefreshError({ id, message: data.error ?? 'Refresh failed' })
    } else {
      await load()
    }
  }

  const handleDelete = async (id: string) => {
    if (deletingId !== id) {
      setDeletingId(id)
      setTimeout(() => setDeletingId(null), 3000)
      return
    }
    await fetch(`/api/pulse/${id}`, { method: 'DELETE' })
    if (activeFeed === id) setActiveFeed(null)
    setDeletingId(null)
    await load()
  }

  const handleClearFeed = async (id: string) => {
    if (clearingId !== id) {
      setClearingId(id)
      setTimeout(() => setClearingId(null), 3000)
      return
    }
    await fetch(`/api/pulse/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear' }),
    })
    setClearingId(null)
    await load()
  }

  const startEdit = (f: PulseFeed) => {
    setEditingId(f.id)
    setEditForm({ name: f.name, url: f.url, type: f.type })
    setDeletingId(null)
  }

  const handleSaveEdit = async (id: string) => {
    setSavingEdit(true)
    await fetch(`/api/pulse/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setSavingEdit(false)
    setEditingId(null)
    await load()
  }

  const handleSaveToJournal = async (itemId: string, folder?: string) => {
    setSavingItemId(itemId)
    await fetch(`/api/pulse/items/${itemId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: folder ?? 'Pulse' }),
    })
    setSavingItemId(null)
    setSavingFolder(sf => { const n = { ...sf }; delete n[itemId]; return n })
    setFeeds(fs => fs.map(f => ({
      ...f,
      items: f.items.map(i => i.id === itemId ? { ...i, savedToJournal: true } : i),
    })))
  }

  const handleUnsaveFromJournal = async (itemId: string) => {
    setSavingItemId(itemId)
    await fetch(`/api/pulse/items/${itemId}`, { method: 'DELETE' })
    setSavingItemId(null)
    setFeeds(fs => fs.map(f => ({
      ...f,
      items: f.items.map(i => i.id === itemId ? { ...i, savedToJournal: false } : i),
    })))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Pulse</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Live feeds — RSS, Reddit, YouTube, Bluesky, Mastodon, and webhooks.
          </p>
          {lastAutoRefresh && (
            <p className="text-xs text-gray-400 mt-0.5">
              {autoRefreshing
                ? <span className="flex items-center gap-1"><RefreshCw size={10} className="animate-spin" /> Refreshing…</span>
                : `Auto-refreshed ${formatRelativeDate(lastAutoRefresh.toISOString())}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Refresh all + auto-refresh picker */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={refreshAll}
              disabled={autoRefreshing}
              title="Refresh all feeds"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={14} className={autoRefreshing ? 'animate-spin' : ''} />
            </button>
            <RefreshDropdown value={autoRefreshMinutes} onChange={setAutoRefreshMinutes} />
          </div>
          <button
            onClick={() => { setShowDirectory(s => !s); setShowAdd(false) }}
            className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              showDirectory
                ? 'bg-gray-100 text-gray-700 border-gray-200'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Globe size={14} />
            Browse directory
          </button>
          <button
            onClick={() => { setShowAdd(s => !s); setShowDirectory(false) }}
            className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {showAdd ? <X size={14} /> : <Plus size={14} />}
            {showAdd ? 'Cancel' : 'Add feed'}
          </button>
        </div>
      </div>

      {/* Journalism: keyword monitoring */}
      {isKeywordMode && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag size={13} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Keyword monitoring</span>
              {activeKeywords.size > 0 && (
                <button
                  onClick={() => setActiveKeywords(new Set())}
                  className="text-xs px-2 py-0.5 rounded-full border border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                >
                  Clear filter
                </button>
              )}
            </div>
            <span className="text-xs text-gray-400">{keywords.length} keyword{keywords.length !== 1 ? 's' : ''}</span>
          </div>
          <form
            onSubmit={e => {
              e.preventDefault()
              const kw = keywordInput.trim()
              if (kw && !keywords.includes(kw)) setKeywords(ks => [...ks, kw])
              setKeywordInput('')
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              placeholder="Add keyword (e.g. climate, corruption)…"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              type="submit"
              disabled={!keywordInput.trim()}
              className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              Add
            </button>
          </form>
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {keywords.map(kw => {
                const active = activeKeywords.has(kw)
                return (
                  <span
                    key={kw}
                    className={cn(
                      'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border cursor-pointer select-none transition-colors',
                      active
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
                    )}
                    onClick={() => setActiveKeywords(s => {
                      const n = new Set(s)
                      n.has(kw) ? n.delete(kw) : n.add(kw)
                      return n
                    })}
                  >
                    {kw}
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setKeywords(ks => ks.filter(k => k !== kw))
                        setActiveKeywords(s => { const n = new Set(s); n.delete(kw); return n })
                      }}
                      className="text-gray-400 hover:text-gray-700"
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

      {/* Add feed form */}
      {showAdd && (
        <PulseAddFeedForm
          form={form}
          setForm={setForm}
          onSubmit={handleAdd}
          adding={adding}
          bskyConfigured={bskyConfigured}
        />
      )}

      {/* Feed directory */}
      {showDirectory && (
        <PulseFeedDirectory
          existingUrls={existingUrls}
          dirCategory={dirCategory}
          setDirCategory={setDirCategory}
          addingFromDir={addingFromDir}
          onAdd={handleAddFromDir}
        />
      )}

      {feeds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
            <Rss size={20} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">No feeds yet.</p>
          <p className="text-xs text-gray-400 mt-1">Add RSS, Reddit, YouTube, Bluesky, or Mastodon feeds.</p>
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          {/* Sidebar — feed list */}
          <aside className="w-56 shrink-0 space-y-1">
            <button
              onClick={() => { setActiveFeed(null); setPage(1) }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                activeFeed === null ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>All feeds</span>
              <span className={`text-xs ${activeFeed === null ? 'text-gray-300' : 'text-gray-400'}`}>{allItems.length}</span>
            </button>

            {feeds.map(f => (
              <div key={f.id}>
                {editingId === f.id ? (
                  // Inline edit form
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 space-y-2">
                    <input
                      autoFocus
                      value={editForm.name}
                      onChange={e => setEditForm(ef => ({ ...ef, name: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
                      placeholder="Feed name"
                    />
                    <input
                      value={editForm.url}
                      onChange={e => setEditForm(ef => ({ ...ef, url: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
                      placeholder="URL / username"
                    />
                    <TypeDropdown value={editForm.type} onChange={v => setEditForm(ef => ({ ...ef, type: v }))} compact />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => handleSaveEdit(f.id)}
                        className="flex-1 flex items-center justify-center gap-1 bg-gray-900 text-white text-xs font-medium py-1 rounded hover:bg-gray-800 disabled:opacity-50"
                      >
                        {savingEdit ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="flex-1 text-xs text-gray-500 py-1 rounded border border-gray-200 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group relative">
                    <button
                      onClick={() => { setActiveFeed(f.id === activeFeed ? null : f.id); setEditingId(null); setPage(1) }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeFeed === f.id ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="truncate text-left">{f.name}</span>
                      <span className={`text-xs shrink-0 ml-1 ${activeFeed === f.id ? 'text-gray-300' : 'text-gray-400'}`}>
                        {f.items.length}
                      </span>
                    </button>

                    {/* Refresh error */}
                    {refreshError?.id === f.id && (
                      <p className="text-[10px] text-red-500 px-3 pb-1 leading-snug">{refreshError.message}</p>
                    )}

                    {/* Feed actions — shown on hover */}
                    <div className="absolute right-1 top-1 hidden group-hover:flex items-center gap-0.5 bg-white/90 rounded">
                      <button
                        onClick={() => handleRefresh(f.id)}
                        disabled={refreshingId === f.id}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                        title="Refresh"
                      >
                        <RefreshCw size={11} className={refreshingId === f.id ? 'animate-spin' : ''} />
                      </button>
                      <button
                        onClick={() => startEdit(f)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                        title="Edit"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => handleClearFeed(f.id)}
                        className={`p-1 rounded ${clearingId === f.id ? 'text-amber-600 bg-amber-50' : 'text-gray-400 hover:text-amber-500 hover:bg-gray-100'}`}
                        title={clearingId === f.id ? 'Click again to clear all items' : 'Clear feed items'}
                      >
                        <Eraser size={11} />
                      </button>
                      <button
                        onClick={() => handleDelete(f.id)}
                        className={`p-1 rounded ${deletingId === f.id ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'}`}
                        title={deletingId === f.id ? 'Click again to confirm delete' : 'Delete feed'}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </aside>

          {/* Main — unified timeline */}
          <div className="flex-1 min-w-0 space-y-3">
            {allItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-gray-500">No items yet.</p>
                <p className="text-xs text-gray-400 mt-1">Refresh a feed to load items.</p>
              </div>
            ) : (
              <>
                {allItems.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map(item => (
                  <PulseItemCard
                    key={item.id}
                    item={item}
                    isKeywordMode={isKeywordMode}
                    activeKeywords={activeKeywords}
                    savingItemId={savingItemId}
                    savingFolder={savingFolder}
                    setSavingFolder={setSavingFolder}
                    onSave={handleSaveToJournal}
                    onUnsave={handleUnsaveFromJournal}
                  />
                ))}

                {/* Pagination */}
                {allItems.length > ITEMS_PER_PAGE && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-gray-400">
                      {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, allItems.length)} of {allItems.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default transition-colors"
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <span className="text-xs text-gray-600 px-2">Page {page} of {Math.ceil(allItems.length / ITEMS_PER_PAGE)}</span>
                      <button
                        onClick={() => setPage(p => Math.min(Math.ceil(allItems.length / ITEMS_PER_PAGE), p + 1))}
                        disabled={page >= Math.ceil(allItems.length / ITEMS_PER_PAGE)}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default transition-colors"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


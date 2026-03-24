'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Rss, Plus, Trash2, RefreshCw, BookOpen, X, ExternalLink, Loader2, ChevronDown, Pencil, Check } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'

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

const TYPE_LABELS: Record<string, string> = {
  rss:      'RSS',
  reddit:   'Reddit',
  youtube:  'YouTube',
  bluesky:  'Bluesky',
  mastodon: 'Mastodon',
  webhook:  'Webhook',
}

const TYPE_COLORS: Record<string, string> = {
  rss:      'bg-orange-50 text-orange-700 border-orange-200',
  reddit:   'bg-red-50 text-red-700 border-red-200',
  youtube:  'bg-red-50 text-red-800 border-red-300',
  bluesky:  'bg-sky-50 text-sky-700 border-sky-200',
  mastodon: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  webhook:  'bg-purple-50 text-purple-700 border-purple-200',
}

const TYPE_HINT: Record<string, string> = {
  rss:      'RSS or Atom feed URL',
  reddit:   'Subreddit name or URL — e.g. r/news',
  youtube:  'YouTube channel URL or channel ID starting with UC',
  bluesky:  'Handle (e.g. you.bsky.social) for public posts, or type "timeline" for your home feed (requires credentials in Settings → AI → Social)',
  mastodon: '@user@instance.social for a public profile, or just instance domain (e.g. mastodon.social) for your home timeline (requires token in Settings → AI → Social)',
  webhook:  'URL returning JSON array of { title, url, summary, publishedAt }',
}

const TYPE_PLACEHOLDER: Record<string, string> = {
  rss:      'https://example.com/feed.xml',
  reddit:   'r/MachineLearning',
  youtube:  'youtube.com/channel/UC…',
  bluesky:  'you.bsky.social  or  timeline',
  mastodon: '@you@mastodon.social  or  mastodon.social',
  webhook:  'https://example.com/webhook',
}

export default function PulsePage() {
  const [feeds, setFeeds] = useState<PulseFeed[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [activeFeed, setActiveFeed] = useState<string | null>(null)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<{ id: string; message: string } | null>(null)
  const [savingItemId, setSavingItemId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', url: '', type: 'rss' })
  const [adding, setAdding] = useState(false)
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', url: '', type: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  // Auto-refresh
  const [autoRefreshMinutes, setAutoRefreshMinutes] = useState<number>(() => {
    if (typeof window !== 'undefined') return parseInt(localStorage.getItem('pulse_autorefresh') ?? '0') || 0
    return 0
  })
  const [autoRefreshing, setAutoRefreshing] = useState(false)
  const [lastAutoRefresh, setLastAutoRefresh] = useState<Date | null>(null)
  const feedsRef = useRef<PulseFeed[]>([])

  const load = useCallback(async () => {
    const res = await fetch('/api/pulse')
    const data = await res.json() as { feeds: PulseFeed[] }
    const feeds = data.feeds ?? []
    setFeeds(feeds)
    feedsRef.current = feeds
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh interval
  useEffect(() => {
    localStorage.setItem('pulse_autorefresh', String(autoRefreshMinutes))
    if (!autoRefreshMinutes) return
    const ms = autoRefreshMinutes * 60 * 1000
    const id = setInterval(async () => {
      const enabled = feedsRef.current.filter(f => f.enabled)
      if (!enabled.length) return
      setAutoRefreshing(true)
      for (const f of enabled) {
        await fetch(`/api/pulse/${f.id}`, { method: 'POST' }).catch(() => {})
      }
      setAutoRefreshing(false)
      setLastAutoRefresh(new Date())
      await load()
    }, ms)
    return () => clearInterval(id)
  }, [autoRefreshMinutes, load])

  const allItems: (PulseItem & { feedName: string; feedType: string })[] = feeds
    .filter(f => f.enabled && (activeFeed === null || f.id === activeFeed))
    .flatMap(f => f.items.map(i => ({ ...i, feedName: f.name, feedType: f.type })))
    .sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
      return tb - ta
    })

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

  const handleSaveToJournal = async (itemId: string) => {
    setSavingItemId(itemId)
    await fetch(`/api/pulse/items/${itemId}`, { method: 'POST' })
    setSavingItemId(null)
    setFeeds(fs => fs.map(f => ({
      ...f,
      items: f.items.map(i => i.id === itemId ? { ...i, savedToJournal: true } : i),
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
          {/* Auto-refresh picker */}
          <div className="flex items-center gap-1.5">
            {autoRefreshing && <RefreshCw size={12} className="animate-spin text-gray-400" />}
            <select
              value={autoRefreshMinutes}
              onChange={e => setAutoRefreshMinutes(parseInt(e.target.value))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-600"
            >
              <option value={0}>No auto-refresh</option>
              <option value={5}>Every 5 min</option>
              <option value={15}>Every 15 min</option>
              <option value={30}>Every 30 min</option>
              <option value={60}>Every hour</option>
            </select>
          </div>
          <button
            onClick={() => setShowAdd(s => !s)}
            className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {showAdd ? <X size={14} /> : <Plus size={14} />}
            {showAdd ? 'Cancel' : 'Add feed'}
          </button>
        </div>
      </div>

      {/* Add feed form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Add feed</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                placeholder="Hacker News"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
              <TypeDropdown value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {form.type === 'twitter' ? 'Username *' : 'URL *'}
            </label>
            <input
              type="text"
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              required
              placeholder={TYPE_PLACEHOLDER[form.type] ?? 'https://…'}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <p className="text-xs text-gray-400 mt-1">{TYPE_HINT[form.type]}</p>
          </div>
          <button
            type="submit"
            disabled={adding}
            className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
          >
            {adding && <Loader2 size={13} className="animate-spin" />}
            {adding ? 'Fetching…' : 'Add feed'}
          </button>
        </form>
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
              onClick={() => setActiveFeed(null)}
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
                      onClick={() => { setActiveFeed(f.id === activeFeed ? null : f.id); setEditingId(null) }}
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
              allItems.map(item => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${TYPE_COLORS[item.feedType] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {item.feedName}
                        </span>
                        {item.publishedAt && (
                          <span className="text-xs text-gray-400">{formatRelativeDate(item.publishedAt)}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 leading-snug">{item.title}</p>
                      {item.summary && item.summary !== item.title && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.summary}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100"
                          title="Open source"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                      <button
                        onClick={() => handleSaveToJournal(item.id)}
                        disabled={item.savedToJournal || savingItemId === item.id}
                        className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border transition-colors ${
                          item.savedToJournal
                            ? 'border-green-200 text-green-600 bg-green-50 cursor-default'
                            : 'border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                        title="Save to Journal"
                      >
                        {savingItemId === item.id
                          ? <Loader2 size={11} className="animate-spin" />
                          : <BookOpen size={11} />
                        }
                        {item.savedToJournal ? 'Saved' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TypeDropdown({ value, onChange, compact }: { value: string; onChange: (v: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const options = ['rss', 'reddit', 'youtube', 'bluesky', 'mastodon', 'webhook']

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full border border-gray-200 rounded-lg px-3 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white ${
          compact ? 'py-1 text-xs' : 'py-2 text-sm h-[38px]'
        }`}
      >
        <span className="text-gray-900">{TYPE_LABELS[value] ?? value}</span>
        <ChevronDown size={compact ? 11 : 14} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-md py-1">
          {options.map(o => (
            <button
              key={o}
              type="button"
              onClick={() => { onChange(o); setOpen(false) }}
              className={`w-full text-left px-3 hover:bg-gray-50 text-gray-900 ${compact ? 'py-1.5 text-xs' : 'py-2 text-sm'}`}
            >
              {TYPE_LABELS[o]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

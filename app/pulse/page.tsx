'use client'

import { useState, useEffect, useCallback } from 'react'
import { Rss, Plus, Trash2, RefreshCw, BookOpen, X, ExternalLink, Loader2, ChevronDown } from 'lucide-react'
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
  rss: 'RSS',
  reddit: 'Reddit',
  youtube: 'YouTube',
  webhook: 'Webhook',
}

const TYPE_COLORS: Record<string, string> = {
  rss:     'bg-orange-50 text-orange-700 border-orange-200',
  reddit:  'bg-red-50 text-red-700 border-red-200',
  youtube: 'bg-red-50 text-red-800 border-red-300',
  webhook: 'bg-purple-50 text-purple-700 border-purple-200',
}

export default function PulsePage() {
  const [feeds, setFeeds] = useState<PulseFeed[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [activeFeed, setActiveFeed] = useState<string | null>(null) // null = all
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [savingItemId, setSavingItemId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', url: '', type: 'rss' })
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/pulse')
    const data = await res.json() as { feeds: PulseFeed[] }
    setFeeds(data.feeds ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Unified timeline — merge items from all enabled feeds, sorted by date
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
    await fetch(`/api/pulse/${id}`, { method: 'POST' })
    setRefreshingId(null)
    await load()
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

  const handleSaveToJournal = async (itemId: string) => {
    setSavingItemId(itemId)
    await fetch(`/api/pulse/items/${itemId}`, { method: 'POST' })
    setSavingItemId(null)
    // Mark saved locally without full reload
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
          <p className="text-gray-500 text-sm mt-0.5">Live feeds from public sources — RSS, Reddit, YouTube, and webhooks.</p>
        </div>
        <button
          onClick={() => setShowAdd(s => !s)}
          className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
        >
          {showAdd ? <X size={14} /> : <Plus size={14} />}
          {showAdd ? 'Cancel' : 'Add feed'}
        </button>
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
            <label className="block text-xs font-medium text-gray-600 mb-1">URL *</label>
            <input
              type="text"
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              required
              placeholder={
                form.type === 'reddit' ? 'r/MachineLearning or reddit.com/r/...' :
                form.type === 'youtube' ? 'youtube.com/channel/UC... or channel ID' :
                'https://example.com/feed.xml'
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <p className="text-xs text-gray-400 mt-1">
              {form.type === 'reddit' && 'Subreddit name or URL — e.g. r/news'}
              {form.type === 'youtube' && 'YouTube channel URL or channel ID starting with UC'}
              {form.type === 'rss' && 'RSS or Atom feed URL'}
              {form.type === 'webhook' && 'Webhook URL that returns JSON array of { title, url, summary, publishedAt }'}
            </p>
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
          <p className="text-xs text-gray-400 mt-1">Add RSS, Reddit, or YouTube feeds to monitor.</p>
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          {/* Sidebar — feed list */}
          <aside className="w-52 shrink-0 space-y-1">
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
              <div key={f.id} className="group relative">
                <button
                  onClick={() => setActiveFeed(f.id === activeFeed ? null : f.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeFeed === f.id ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="truncate text-left">{f.name}</span>
                  <span className={`text-xs shrink-0 ${activeFeed === f.id ? 'text-gray-300' : 'text-gray-400'}`}>
                    {f.items.length}
                  </span>
                </button>

                {/* Feed actions — shown on hover */}
                <div className="absolute right-1 top-1 hidden group-hover:flex items-center gap-0.5">
                  <button
                    onClick={() => handleRefresh(f.id)}
                    disabled={refreshingId === f.id}
                    className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700"
                    title="Refresh"
                  >
                    <RefreshCw size={11} className={refreshingId === f.id ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => handleDelete(f.id)}
                    className={`p-1 rounded text-xs ${deletingId === f.id ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-red-500 hover:bg-gray-200'}`}
                    title={deletingId === f.id ? 'Click again to confirm' : 'Delete feed'}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
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
                <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${TYPE_COLORS[item.feedType] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {item.feedName}
                        </span>
                        {item.publishedAt && (
                          <span className="text-xs text-gray-400">{formatRelativeDate(item.publishedAt)}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 leading-snug">{item.title}</p>
                      {item.summary && (
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

function TypeDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const options = ['rss', 'reddit', 'youtube', 'webhook']

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white h-[38px]"
      >
        <span className="text-gray-900">{TYPE_LABELS[value] ?? value}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-md py-1">
          {options.map(o => (
            <button
              key={o}
              type="button"
              onClick={() => { onChange(o); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-900"
            >
              {TYPE_LABELS[o]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Globe, BookOpen, Upload } from '@/components/icons'
import { ArrowLeft, ArrowRight, X, Bookmark, BookmarkCheck, ExternalLink, Loader2, AlignLeft, Monitor, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import DispatchPanel from '@/app/dispatch/DispatchPanel'

// ── Types ─────────────────────────────────────────────────────────────────────

type PageResult =
  | { type: 'article'; title: string; favicon: string | null; html: string; text: string; url: string }
  | { type: 'youtube'; videoId: string; url: string }
  | { type: 'spotify'; embedUrl: string; url: string }
  | { type: 'error'; error: string; fallbackUrl: string }

type ViewMode = 'reader' | 'live'

interface Tab {
  id: string
  urlInput: string
  currentUrl: string
  viewMode: ViewMode
  loading: boolean
  page: PageResult | null
  history: string[]
  historyIndex: number
}

interface BrowserBookmark {
  id: string
  url: string
  title: string
  favicon: string | null
  createdAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _tabIdCounter = 0
function makeTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: String(++_tabIdCounter),
    urlInput: '',
    currentUrl: '',
    viewMode: 'live',
    loading: false,
    page: null,
    history: [],
    historyIndex: -1,
    ...overrides,
  }
}

function normalizeUrl(input: string): string {
  const s = input.trim()
  if (!s) return s
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  if (s.includes(' ') || (!s.includes('.') && !s.startsWith('localhost'))) {
    return `https://www.google.com/search?q=${encodeURIComponent(s)}`
  }
  return `https://${s}`
}

// Only specific video/track URLs get the embed player — not homepages or channels
function isYouTubeVideo(url: string) {
  return /youtube\.com\/watch(\?|$)/.test(url)
    || /youtu\.be\/[a-zA-Z0-9_-]{11}/.test(url)
    || /youtube\.com\/shorts\/[a-zA-Z0-9_-]{11}/.test(url)
}
function isYouTubeDomain(url: string) {
  return /(?:www\.)?youtube\.com|youtu\.be/.test(url)
}
function isSpotifyEmbed(url: string) {
  return /open\.spotify\.com\/(track|album|playlist|episode|show)\//.test(url)
}
function isEmbedUrl(url: string) {
  return isYouTubeVideo(url) || isSpotifyEmbed(url)
}

function tabLabel(tab: Tab): string {
  if (!tab.currentUrl) return 'New tab'
  if (tab.page?.type === 'article' && tab.page.title) return tab.page.title
  try { return new URL(tab.currentUrl).hostname.replace(/^www\./, '') } catch { return tab.currentUrl }
}

// ── Session persistence ───────────────────────────────────────────────────────

const SESSION_KEY = 'operator_browser_tabs'

function saveTabs(tabs: Tab[], activeId: string) {
  try {
    const slim = tabs.map(t => ({
      id: t.id, urlInput: t.urlInput, currentUrl: t.currentUrl,
      viewMode: t.viewMode, history: t.history, historyIndex: t.historyIndex,
    }))
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ tabs: slim, activeId }))
  } catch {}
}

function loadSavedTabs(): { tabs: Tab[]; activeId: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const { tabs, activeId } = JSON.parse(raw) as { tabs: Partial<Tab>[]; activeId: string }
    if (!tabs?.length) return null
    return {
      tabs: tabs.map(t => makeTab({ ...t, loading: false, page: null })),
      activeId,
    }
  } catch { return null }
}

// ── Start page ────────────────────────────────────────────────────────────────

function StartPage({ onNavigate, bookmarks }: { onNavigate: (url: string) => void; bookmarks: BrowserBookmark[] }) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) onNavigate(input.trim())
  }

  const features = [
    {
      icon: <AlignLeft size={18} className="text-violet-500" />,
      title: 'Reader mode',
      desc: 'Distraction-free article view with images. Works on most sites — great for reading reports and articles.',
    },
    {
      icon: <Monitor size={18} className="text-indigo-500" />,
      title: 'Live mode',
      desc: 'Full page in an iframe. Use this when you need to log in, accept cookies, or interact with a page. Some sites block this.',
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-red-500">
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
          <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
        </svg>
      ),
      title: 'YouTube & Spotify',
      desc: 'Paste a video or track URL and it plays inline — music keeps going while you work in Dispatch on the right.',
    },
    {
      icon: <Upload size={18} className="text-emerald-500" />,
      title: 'Import to Operator',
      desc: 'Hit Import to send the current page straight to your library for AI analysis.',
    },
    {
      icon: <Bookmark size={18} className="text-amber-500" />,
      title: 'Bookmarks',
      desc: 'Save any page with one click. Bookmarks appear here on every new tab.',
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-sky-500">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
      title: 'Ask Dispatch',
      desc: 'Dispatch always knows what you\'re reading. Ask it to summarise, explain, or analyse anything on the page.',
    },
  ]

  return (
    <div className="h-full overflow-y-auto bg-[#fafafa]">
      <div className="max-w-2xl mx-auto px-6 pt-16 pb-12">
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={20} className="text-gray-400" />
            <h1 className="text-lg font-semibold text-gray-700">Operator Browser</h1>
          </div>
          <form onSubmit={handleSubmit} className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Enter a URL or search…"
              className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all shadow-sm"
              spellCheck={false}
            />
          </form>
        </div>

        <div className="mb-10">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">What you can do here</p>
          <div className="grid grid-cols-2 gap-3">
            {features.map(f => (
              <div key={f.title} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  {f.icon}
                  <span className="text-sm font-medium text-gray-800">{f.title}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {bookmarks.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Bookmarks</p>
            <ul className="space-y-1">
              {bookmarks.map(bm => (
                <li key={bm.id}>
                  <button
                    onClick={() => onNavigate(bm.url)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm text-left transition-all"
                  >
                    {bm.favicon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={bm.favicon} alt="" className="w-4 h-4 shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    ) : (
                      <Globe size={13} className="text-gray-400 shrink-0" />
                    )}
                    <span className="flex-1 text-xs text-gray-700 truncate font-medium">{bm.title}</span>
                    <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{bm.url.replace(/^https?:\/\//, '').split('/')[0]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Article renderer ───────────────────────────────────────────────────────────

function ArticleView({ html }: { html: string }) {
  return (
    <div
      className="max-w-3xl mx-auto px-8 py-6
        [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-3
        [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-gray-900 [&_h1]:mt-6 [&_h1]:mb-3
        [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:mt-5 [&_h2]:mb-2
        [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-gray-800 [&_h3]:mt-4 [&_h3]:mb-1
        [&_p]:text-[15px] [&_p]:text-gray-700 [&_p]:leading-relaxed [&_p]:mb-3
        [&_a]:text-indigo-600 [&_a]:underline
        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3
        [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3
        [&_li]:text-[15px] [&_li]:text-gray-700 [&_li]:mb-1
        [&_blockquote]:border-l-4 [&_blockquote]:border-gray-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-500
        [&_pre]:bg-gray-50 [&_pre]:rounded [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:text-xs
        [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BrowserPage() {
  // Always start with a fresh tab on SSR — sessionStorage is loaded after mount
  const [tabs, setTabs] = useState<Tab[]>(() => [makeTab()])
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id ?? '')
  const [hydrated, setHydrated] = useState(false)
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>([])
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [dispatchContext, setDispatchContext] = useState('')
  const bookmarkPanelRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef(tabs)
  useEffect(() => { tabsRef.current = tabs }, [tabs])

  // After mount: restore from sessionStorage (SSR-safe — runs client-only)
  useEffect(() => {
    setHydrated(true)
    const urlParam = new URLSearchParams(window.location.search).get('url')
    const saved = loadSavedTabs()

    if (urlParam) {
      // Pulse/external link: open in a new tab
      const base = saved?.tabs ?? [makeTab()]
      const newTab = makeTab()
      const next = [...base, newTab]
      // Update ref synchronously so navigate() can find the tab immediately
      tabsRef.current = next
      setTabs(next)
      setActiveTabId(newTab.id)
      navigate(newTab.id, urlParam)
    } else if (saved) {
      setTabs(saved.tabs)
      setActiveTabId(saved.activeId)
      // Re-fetch content for the active tab
      const active = saved.tabs.find(t => t.id === saved.activeId) ?? saved.tabs[0]
      if (active?.currentUrl) {
        setTimeout(() => doFetch(active.id, active.currentUrl, active.viewMode), 0)
      }
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist to sessionStorage whenever tabs change (only after hydration)
  useEffect(() => {
    if (hydrated) saveTabs(tabs, activeTabId)
  }, [tabs, activeTabId, hydrated])

  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0]

  useEffect(() => {
    fetch('/api/browser/bookmarks')
      .then(r => r.json())
      .then((d: { bookmarks?: BrowserBookmark[] }) => setBookmarks(d.bookmarks ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bookmarkPanelRef.current && !bookmarkPanelRef.current.contains(e.target as Node)) {
        setShowBookmarks(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Tab management ──────────────────────────────────────────────────────────

  const updateTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }, [])

  const addTab = () => {
    const tab = makeTab()
    setTabs(prev => [...prev, tab])
    setActiveTabId(tab.id)
    setImportDone(false)
  }

  const closeTab = (id: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      if (next.length === 0) {
        const fresh = makeTab()
        setActiveTabId(fresh.id)
        return [fresh]
      }
      if (activeTabId === id) {
        const idx = prev.findIndex(t => t.id === id)
        setActiveTabId(next[Math.min(idx, next.length - 1)].id)
      }
      return next
    })
  }

  // ── Fetching ─────────────────────────────────────────────────────────────────

  const doFetch = useCallback(async (tabId: string, url: string, viewMode: ViewMode) => {
    // YouTube/Spotify embed: just extract ID from URL — no network needed
    if (isYouTubeVideo(url)) {
      const res = await fetch('/api/browser/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      const data = await res.json() as PageResult
      updateTab(tabId, { page: data, loading: false })
      setDispatchContext(`The user is watching a YouTube video at ${url}`)
      return
    }
    if (isSpotifyEmbed(url)) {
      const res = await fetch('/api/browser/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      const data = await res.json() as PageResult
      updateTab(tabId, { page: data, loading: false })
      return
    }
    // YouTube domain but not a video URL: don't fetch server-side, let live mode handle it
    if (isYouTubeDomain(url) && viewMode === 'live') {
      updateTab(tabId, { loading: false })
      return
    }
    // Reader mode OR YouTube non-video: fetch server-side
    if (viewMode === 'reader' || isYouTubeDomain(url)) {
      try {
        const res = await fetch('/api/browser/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
        const data = await res.json() as PageResult
        updateTab(tabId, { page: data, loading: false })
        if (data.type === 'article') {
          setDispatchContext(`The user is reading: "${data.title}" at ${url}.\n\n${data.text.slice(0, 3000)}`)
        }
      } catch {
        updateTab(tabId, { page: { type: 'error', error: 'Request failed', fallbackUrl: url }, loading: false })
      }
    } else {
      // Live mode: iframe handles it directly
      updateTab(tabId, { loading: false })
      setDispatchContext(`The user has the browser open at ${url}`)
    }
  }, [updateTab])

  // ── Navigation ──────────────────────────────────────────────────────────────

  const navigate = useCallback(async (tabId: string, rawUrl: string) => {
    const url = normalizeUrl(rawUrl)
    if (!url) return
    setImportDone(false)

    const tab = tabsRef.current.find(t => t.id === tabId)
    if (!tab) return

    const newHistory = [...tab.history.slice(0, tab.historyIndex + 1), url]
    updateTab(tabId, {
      urlInput: url, currentUrl: url, page: null, loading: true,
      history: newHistory, historyIndex: newHistory.length - 1,
    })

    await doFetch(tabId, url, tab.viewMode)
  }, [updateTab, doFetch])

  const navigateActive = useCallback((rawUrl: string) => {
    if (activeTab) navigate(activeTab.id, rawUrl)
  }, [activeTab, navigate])

  const switchMode = useCallback((mode: ViewMode) => {
    const tab = tabsRef.current.find(t => t.id === activeTab?.id)
    if (!tab || tab.viewMode === mode) return
    updateTab(tab.id, { viewMode: mode, page: null })
    if (tab.currentUrl) {
      updateTab(tab.id, { loading: true })
      doFetch(tab.id, tab.currentUrl, mode)
    }
  }, [activeTab, updateTab, doFetch])

  const goBack = () => {
    const tab = tabsRef.current.find(t => t.id === activeTab?.id)
    if (!tab || tab.historyIndex <= 0) return
    const url = tab.history[tab.historyIndex - 1]
    updateTab(tab.id, { historyIndex: tab.historyIndex - 1 })
    navigate(tab.id, url)
  }

  const goForward = () => {
    const tab = tabsRef.current.find(t => t.id === activeTab?.id)
    if (!tab || tab.historyIndex >= tab.history.length - 1) return
    const url = tab.history[tab.historyIndex + 1]
    updateTab(tab.id, { historyIndex: tab.historyIndex + 1 })
    navigate(tab.id, url)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (activeTab) navigate(activeTab.id, activeTab.urlInput)
  }

  // ── Bookmarks ───────────────────────────────────────────────────────────────

  const isBookmarked = activeTab ? bookmarks.some(b => b.url === activeTab.currentUrl) : false

  const toggleBookmark = async () => {
    if (!activeTab?.currentUrl) return
    if (isBookmarked) {
      const bm = bookmarks.find(b => b.url === activeTab.currentUrl)
      if (!bm) return
      await fetch(`/api/browser/bookmarks?id=${bm.id}`, { method: 'DELETE' })
      setBookmarks(prev => prev.filter(b => b.id !== bm.id))
    } else {
      const title = (activeTab.page?.type === 'article' ? activeTab.page.title : null) || activeTab.currentUrl
      const favicon = activeTab.page?.type === 'article' ? activeTab.page.favicon : null
      const res = await fetch('/api/browser/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: activeTab.currentUrl, title, favicon }),
      })
      const data = await res.json() as { bookmark?: BrowserBookmark }
      if (data.bookmark) setBookmarks(prev => [data.bookmark!, ...prev])
    }
  }

  const importToOperator = async () => {
    if (!activeTab?.currentUrl) return
    setImporting(true)
    try {
      const title = (activeTab.page?.type === 'article' ? activeTab.page.title : null) || activeTab.currentUrl
      await fetch('/api/upload-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: activeTab.currentUrl, title, area: 'Other' }),
      })
      setImportDone(true)
    } catch { /* silently fail */ }
    finally { setImporting(false) }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!activeTab) return null

  const canBack    = activeTab.historyIndex > 0
  const canForward = activeTab.historyIndex < activeTab.history.length - 1
  const isEmbed    = activeTab.page?.type === 'youtube' || activeTab.page?.type === 'spotify'
  const isYTDomain = activeTab.currentUrl ? isYouTubeDomain(activeTab.currentUrl) : false
  const isYTVideo  = activeTab.currentUrl ? isYouTubeVideo(activeTab.currentUrl) : false
  // Live iframe: show only when in live mode, not an embed, not a YouTube domain
  const showIframe = activeTab.viewMode === 'live' && !!activeTab.currentUrl && !isEmbed && !isEmbedUrl(activeTab.currentUrl) && !isYTDomain

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">

        {/* Tab bar — Safari style */}
        <div className="flex items-center gap-1 bg-white border-b border-gray-200 px-3 py-1.5 overflow-x-auto shrink-0">
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId
            const label = tabLabel(tab)
            const favicon = tab.page?.type === 'article' ? tab.page.favicon : null
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] cursor-pointer select-none min-w-0 max-w-[160px] shrink-0 group transition-colors',
                  isActive ? 'bg-gray-100 text-gray-800 font-medium' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                )}
              >
                {favicon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={favicon} alt="" className="w-3 h-3 shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                ) : (
                  <Globe size={11} className="shrink-0 text-gray-400" />
                )}
                <span className="truncate flex-1">{label}</span>
                <button
                  onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
                  className="shrink-0 rounded p-0.5 ml-0.5 text-transparent group-hover:text-gray-400 hover:!text-gray-600 transition-colors"
                >
                  <X size={9} />
                </button>
              </div>
            )
          })}
          <button onClick={addTab} title="New tab" className="flex items-center justify-center w-6 h-6 ml-0.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0">
            <Plus size={12} />
          </button>
        </div>

        {/* URL bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white shrink-0">
          <button onClick={goBack} disabled={!canBack} className={cn('p-1.5 rounded-md transition-colors', canBack ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300 cursor-default')}>
            <ArrowLeft size={15} />
          </button>
          <button onClick={goForward} disabled={!canForward} className={cn('p-1.5 rounded-md transition-colors', canForward ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300 cursor-default')}>
            <ArrowRight size={15} />
          </button>

          <form onSubmit={handleSubmit} className="flex-1">
            <input
              type="text"
              value={activeTab.urlInput}
              onChange={e => updateTab(activeTab.id, { urlInput: e.target.value })}
              placeholder="Enter a URL or search…"
              className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 focus:bg-white transition-colors font-mono"
              spellCheck={false}
            />
          </form>

          {/* Mode toggle — hidden for embeds/YouTube */}
          {!isEmbed && !isYTVideo && activeTab.currentUrl && (
            <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden shrink-0">
              <button
                onClick={() => switchMode('live')}
                title="Live mode — full iframe, use for logins & interactions. Many sites block this."
                className={cn('flex items-center gap-1 px-2 py-1.5 text-xs transition-colors', activeTab.viewMode === 'live' ? 'bg-gray-100 text-gray-800 font-medium' : 'text-gray-500 hover:bg-gray-50')}
              >
                <Monitor size={12} /> Live
              </button>
              <button
                onClick={() => switchMode('reader')}
                title="Reader mode — server-side extraction, works on most sites"
                className={cn('flex items-center gap-1 px-2 py-1.5 text-xs transition-colors border-l border-gray-200', activeTab.viewMode === 'reader' ? 'bg-gray-100 text-gray-800 font-medium' : 'text-gray-500 hover:bg-gray-50')}
              >
                <AlignLeft size={12} /> Reader
              </button>
            </div>
          )}

          <button onClick={toggleBookmark} disabled={!activeTab.currentUrl} title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'} className={cn('p-1.5 rounded-md transition-colors', activeTab.currentUrl ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300 cursor-default')}>
            {isBookmarked ? <BookmarkCheck size={15} className="text-indigo-600" /> : <Bookmark size={15} />}
          </button>

          <div className="relative" ref={bookmarkPanelRef}>
            <button onClick={() => setShowBookmarks(s => !s)} title="Bookmarks" className={cn('p-1.5 rounded-md transition-colors', showBookmarks ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:bg-gray-100')}>
              <BookOpen size={15} />
            </button>
            {showBookmarks && (
              <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Bookmarks</span>
                  <button onClick={() => setShowBookmarks(false)} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
                </div>
                {bookmarks.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-gray-400 text-center">No bookmarks yet</p>
                ) : (
                  <ul className="max-h-72 overflow-y-auto">
                    {bookmarks.map(bm => (
                      <li key={bm.id}>
                        <button onClick={() => { navigateActive(bm.url); setShowBookmarks(false) }} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors">
                          {bm.favicon ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={bm.favicon} alt="" className="w-4 h-4 shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          ) : (
                            <Globe size={14} className="text-gray-400 shrink-0" />
                          )}
                          <span className="flex-1 text-xs text-gray-700 truncate">{bm.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {activeTab.currentUrl && (
            <button onClick={importToOperator} disabled={importing || importDone} title={importDone ? 'Imported!' : 'Import to Operator'}
              className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0',
                importDone ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100')}
            >
              {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {importDone ? 'Imported' : 'Import'}
            </button>
          )}

          {activeTab.currentUrl && (
            <a href={activeTab.currentUrl} target="_blank" rel="noopener noreferrer" title="Open in browser tab" className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <ExternalLink size={14} />
            </a>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 relative overflow-hidden bg-white">

          {/* Start page */}
          {!activeTab.currentUrl && (
            <StartPage onNavigate={navigateActive} bookmarks={bookmarks} />
          )}

          {/* Universal loading spinner */}
          {activeTab.loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#fafafa] z-10">
              <Loader2 size={28} className="animate-spin text-gray-300" />
            </div>
          )}

          {/* YouTube embed */}
          {!activeTab.loading && activeTab.page?.type === 'youtube' && (
            <div className="h-full flex flex-col items-center justify-center bg-black p-4">
              <iframe
                src={`https://www.youtube.com/embed/${activeTab.page.videoId}?autoplay=0`}
                className="w-full max-w-4xl aspect-video rounded-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {/* Spotify embed */}
          {!activeTab.loading && activeTab.page?.type === 'spotify' && (
            <div className="h-full flex items-center justify-center p-6 bg-[#fafafa]">
              <iframe
                src={activeTab.page.embedUrl}
                className="w-full max-w-lg rounded-2xl"
                height="352"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            </div>
          )}

          {/* YouTube domain (non-video): explain + open in tab */}
          {!activeTab.loading && !isYTVideo && isYTDomain && activeTab.currentUrl && (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-6 bg-[#fafafa]">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-red-400">
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
                  <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">YouTube blocks embedding</p>
                <p className="text-xs text-gray-500 mt-1 max-w-xs">Paste a specific video URL (youtube.com/watch?v=…) to play it inline, or open YouTube in a browser tab.</p>
              </div>
              <a href={activeTab.currentUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium rounded-lg border border-red-200 transition-colors">
                <ExternalLink size={12} /> Open YouTube in tab
              </a>
            </div>
          )}

          {/* Reader: article */}
          {!activeTab.loading && activeTab.viewMode === 'reader' && activeTab.page?.type === 'article' && (
            <div className="h-full overflow-y-auto bg-[#fafafa]">
              <ArticleView html={activeTab.page.html} />
            </div>
          )}

          {/* Reader/Live: error */}
          {!activeTab.loading && activeTab.page?.type === 'error' && (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-6 bg-[#fafafa]">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                <Search size={20} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Couldn&apos;t load this page</p>
                <p className="text-xs text-gray-500 mt-1">{activeTab.page.error}</p>
              </div>
              <div className="flex gap-2">
                {activeTab.viewMode === 'reader' && (
                  <button onClick={() => switchMode('live')} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors">
                    <Monitor size={12} /> Try Live mode
                  </button>
                )}
                <a href={activeTab.page.fallbackUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium rounded-lg border border-indigo-200 transition-colors">
                  <ExternalLink size={12} /> Open in tab
                </a>
              </div>
            </div>
          )}

          {/* Live iframe */}
          {showIframe && !activeTab.loading && (
            <iframe
              key={activeTab.currentUrl}
              src={activeTab.currentUrl}
              className="absolute inset-0 w-full h-full border-0"
              title="browser"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
            />
          )}
        </div>
      </div>

      {/* Dispatch */}
      <aside className="w-[320px] shrink-0 h-full border-l border-gray-200 overflow-hidden">
        <DispatchPanel context={dispatchContext} />
      </aside>
    </div>
  )
}


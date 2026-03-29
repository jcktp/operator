'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Globe, BookOpen, Upload } from '@/components/icons'
import { ArrowLeft, ArrowRight, X, Bookmark, BookmarkCheck, ExternalLink, Loader2, AlignLeft, Monitor, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import DispatchPanel from '@/app/dispatch/DispatchPanel'
import {
  type Tab, type BrowserBookmark, type PageResult, type ViewMode,
  makeTab, normalizeUrl, isYouTubeVideo, isYouTubeDomain, isSpotifyEmbed, isEmbedUrl,
  isKnownIframeBlocked, tabLabel, saveTabs, loadSavedTabs,
} from './browserHelpers'
import BrowserStartPage from './BrowserStartPage'
import BrowserArticleView from './BrowserArticleView'
import BrowserImportModal from './BrowserImportModal'

// Reliably opens a URL in a new browser tab — works across popup-blocked and PWA contexts
function openExternal(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BrowserPage() {
  const [airGapped, setAirGapped] = useState(false)
  // Always start with a fresh tab on SSR — sessionStorage is loaded after mount
  const [tabs, setTabs] = useState<Tab[]>(() => [makeTab()])
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id ?? '')
  const [hydrated, setHydrated] = useState(false)
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>([])
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importModalTitle, setImportModalTitle] = useState('')
  const [importModalDate, setImportModalDate] = useState('')
  const [dispatchContext, setDispatchContext] = useState('')
  const bookmarkPanelRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef(tabs)
  useEffect(() => { tabsRef.current = tabs }, [tabs])

  // Check air gap setting on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((d: { settings?: Record<string, string> }) => {
        if (d.settings?.air_gap_mode === 'true') setAirGapped(true)
      })
      .catch(() => {})
  }, [])

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
    // Reset context immediately so stale content from a previous page is never used
    setDispatchContext(`The user has the browser open at ${url}`)

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
    // Known iframe-blocked domains: skip iframe, show clear UI immediately
    if (viewMode === 'live' && isKnownIframeBlocked(url)) {
      const host = (() => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url } })()
      updateTab(tabId, {
        page: { type: 'error', error: `${host} blocks embedding in external apps. Open it in a tab to use it normally.`, fallbackUrl: url },
        loading: false,
      })
      return
    }

    // Reader mode OR YouTube non-video: fetch server-side
    if (viewMode === 'reader' || isYouTubeDomain(url)) {
      try {
        const res = await fetch('/api/browser/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
        const data = await res.json() as PageResult
        // Detect JS-only pages: article returned but with negligible text content
        if (data.type === 'article' && data.text.trim().length < 200) {
          updateTab(tabId, {
            page: { type: 'error', error: 'This page requires JavaScript to render and can\'t be read in Reader mode. Try Live mode or open it in a tab.', fallbackUrl: url },
            loading: false,
          })
          return
        }
        updateTab(tabId, { page: data, loading: false })
        if (data.type === 'article') {
          setDispatchContext(`The user is reading: "${data.title}" at ${url}.\n\n${data.text.slice(0, 3000)}`)
        }
      } catch {
        updateTab(tabId, { page: { type: 'error', error: 'Request failed', fallbackUrl: url }, loading: false })
      }
    } else {
      // Live mode: show iframe directly — overlay hint handles any remaining sites that block embedding
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
      const text = (activeTab.viewMode === 'reader' && activeTab.page?.type === 'article')
        ? activeTab.page.text
        : `Source: ${activeTab.currentUrl}`
      const res = await fetch('/api/browser/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, text, area: 'Other' }),
      })
      if (res.ok) {
        setImportDone(true)
      } else {
        const d = await res.json() as { error?: string }
        console.error('Import failed:', d.error)
      }
    } catch (e) {
      console.error('Import error:', e)
    } finally {
      setImporting(false)
    }
  }

  const handleTextSelect = () => {
    const sel = window.getSelection()
    const text = sel?.toString().trim() ?? ''
    if (text.length > 20) setSelectedText(text)
    else setSelectedText('')
  }

  const openSelectionModal = () => {
    const title = (activeTab?.page?.type === 'article' ? activeTab.page.title : null)
    setImportModalTitle(title ? `Selection: ${title}` : `Selection from ${activeTab?.currentUrl ?? ''}`)
    setImportModalDate(new Date().toISOString().slice(0, 10))
    setShowImportModal(true)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!activeTab) return null

  if (airGapped) {
    return (
      <div className="flex h-full items-center justify-center bg-[#fafafa] dark:bg-zinc-950">
        <div className="text-center space-y-3 max-w-sm px-6">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center mx-auto">
            <ExternalLink size={20} className="text-red-400" />
          </div>
          <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100">Browser blocked</p>
          <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">Air-gap mode is enabled. The in-app browser is disabled to prevent external network access. Disable air-gap mode in Settings → Security to use the browser.</p>
        </div>
      </div>
    )
  }

  const canBack    = activeTab.historyIndex > 0
  const canForward = activeTab.historyIndex < activeTab.history.length - 1
  const isEmbed    = activeTab.page?.type === 'youtube' || activeTab.page?.type === 'spotify'
  const isYTDomain = activeTab.currentUrl ? isYouTubeDomain(activeTab.currentUrl) : false
  const isYTVideo  = activeTab.currentUrl ? isYouTubeVideo(activeTab.currentUrl) : false
  // Live iframe: show only when in live mode, not an embed, not a YouTube domain
  const showIframe = activeTab.viewMode === 'live' && !!activeTab.currentUrl && !isEmbed && !isEmbedUrl(activeTab.currentUrl) && !isYTDomain && activeTab.page?.type !== 'error'

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0 h-full">

        {/* Tab bar — Safari style */}
        <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 px-3 py-1.5 overflow-x-auto shrink-0">
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
                  isActive ? 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 font-medium' : 'text-gray-400 dark:text-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-gray-600 dark:hover:text-zinc-300'
                )}
              >
                {favicon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={favicon} alt="" className="w-3 h-3 shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                ) : (
                  <Globe size={11} className="shrink-0 text-gray-400 dark:text-zinc-500" />
                )}
                <span className="truncate flex-1">{label}</span>
                <button
                  onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
                  className="shrink-0 rounded p-0.5 ml-0.5 text-transparent group-hover:text-gray-400 dark:group-hover:text-zinc-500 hover:!text-gray-600 dark:hover:!text-zinc-300 transition-colors"
                >
                  <X size={9} />
                </button>
              </div>
            )
          })}
          <button onClick={addTab} title="New tab" className="flex items-center justify-center w-6 h-6 ml-0.5 rounded-md text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors shrink-0">
            <Plus size={12} />
          </button>
        </div>

        {/* URL bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shrink-0">
          <button onClick={goBack} disabled={!canBack} className={cn('p-1.5 rounded-md transition-colors', canBack ? 'text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800' : 'text-gray-300 dark:text-zinc-600 cursor-default')}>
            <ArrowLeft size={15} />
          </button>
          <button onClick={goForward} disabled={!canForward} className={cn('p-1.5 rounded-md transition-colors', canForward ? 'text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800' : 'text-gray-300 dark:text-zinc-600 cursor-default')}>
            <ArrowRight size={15} />
          </button>

          <form onSubmit={handleSubmit} className="flex-1">
            <input
              type="text"
              value={activeTab.urlInput}
              onChange={e => updateTab(activeTab.id, { urlInput: e.target.value })}
              placeholder="Enter a URL or search…"
              className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-zinc-400 focus:bg-white dark:focus:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 transition-colors"
              spellCheck={false}
            />
          </form>

          {/* Mode toggle — hidden for embeds/YouTube */}
          {!isEmbed && !isYTVideo && activeTab.currentUrl && (
            <div className="flex items-center rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden shrink-0">
              <button
                onClick={() => switchMode('live')}
                title="Live mode — full iframe, use for logins & interactions. Many sites block this."
                className={cn('flex items-center gap-1 px-2 py-1.5 text-xs transition-colors', activeTab.viewMode === 'live' ? 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 font-medium' : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800')}
              >
                <Monitor size={12} /> Live
              </button>
              <button
                onClick={() => switchMode('reader')}
                title="Reader mode — server-side extraction, works on most sites"
                className={cn('flex items-center gap-1 px-2 py-1.5 text-xs transition-colors border-l border-gray-200 dark:border-zinc-700', activeTab.viewMode === 'reader' ? 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 font-medium' : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800')}
              >
                <AlignLeft size={12} /> Reader
              </button>
            </div>
          )}

          <button onClick={toggleBookmark} disabled={!activeTab.currentUrl} title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'} className={cn('p-1.5 rounded-md transition-colors', activeTab.currentUrl ? 'text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800' : 'text-gray-300 dark:text-zinc-600 cursor-default')}>
            {isBookmarked ? <BookmarkCheck size={15} className="text-indigo-600" /> : <Bookmark size={15} />}
          </button>

          <div className="relative" ref={bookmarkPanelRef}>
            <button onClick={() => setShowBookmarks(s => !s)} title="Bookmarks" className={cn('p-1.5 rounded-md transition-colors', showBookmarks ? 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-100' : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800')}>
              <BookOpen size={15} />
            </button>
            {showBookmarks && (
              <div className="absolute left-0 top-full mt-1 w-72 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg z-30 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600 dark:text-zinc-300">Bookmarks</span>
                  <button onClick={() => setShowBookmarks(false)} className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"><X size={12} /></button>
                </div>
                {bookmarks.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-gray-400 dark:text-zinc-500 text-center">No bookmarks yet</p>
                ) : (
                  <ul className="max-h-72 overflow-y-auto">
                    {bookmarks.map(bm => (
                      <li key={bm.id}>
                        <button onClick={() => { navigateActive(bm.url); setShowBookmarks(false) }} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800 text-left transition-colors">
                          {bm.favicon ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={bm.favicon} alt="" className="w-4 h-4 shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          ) : (
                            <Globe size={14} className="text-gray-400 dark:text-zinc-500 shrink-0" />
                          )}
                          <span className="flex-1 text-xs text-gray-700 dark:text-zinc-200 truncate">{bm.title}</span>
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
                importDone ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900')}
            >
              {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {importDone ? 'Imported' : 'Import'}
            </button>
          )}

          {activeTab.currentUrl && (
            <button onClick={() => openExternal(activeTab.currentUrl)} title="Open in browser tab" className="p-1.5 rounded-md text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
              <ExternalLink size={14} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 relative overflow-hidden bg-white dark:bg-zinc-900">

          {/* Start page */}
          {!activeTab.currentUrl && (
            <BrowserStartPage onNavigate={navigateActive} bookmarks={bookmarks} />
          )}

          {/* Universal loading spinner */}
          {activeTab.loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#fafafa] dark:bg-zinc-950 z-10">
              <Loader2 size={28} className="animate-spin text-gray-300 dark:text-zinc-600" />
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
            <div className="h-full flex items-center justify-center p-6 bg-[#fafafa] dark:bg-zinc-950">
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
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-6 bg-[#fafafa] dark:bg-zinc-950">
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-red-400">
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
                  <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-zinc-200">YouTube blocks embedding</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-xs">Paste a specific video URL (youtube.com/watch?v=…) to play it inline, or open YouTube in a browser tab.</p>
              </div>
              <button onClick={() => openExternal(activeTab.currentUrl)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900 text-red-700 dark:text-red-300 text-xs font-medium rounded-lg border border-red-200 dark:border-red-800 transition-colors">
                <ExternalLink size={12} /> Open YouTube in tab
              </button>
            </div>
          )}

          {/* Reader: article */}
          {!activeTab.loading && activeTab.viewMode === 'reader' && activeTab.page?.type === 'article' && (
            <div className="h-full overflow-y-auto bg-[#fafafa] dark:bg-zinc-950 relative" onMouseUp={handleTextSelect}>
              <BrowserArticleView html={activeTab.page.html} />
              {/* Floating selection toolbar */}
              {selectedText && (
                <div className="sticky bottom-16 left-0 right-0 flex justify-center pointer-events-none">
                  <div className="pointer-events-auto flex items-center gap-2 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl px-3 py-2 shadow-lg">
                    <span className="text-xs text-gray-300 dark:text-zinc-500">{selectedText.length} chars</span>
                    <button
                      onClick={openSelectionModal}
                      className="flex items-center gap-1.5 text-xs font-medium hover:text-gray-200 dark:hover:text-zinc-700 transition-colors"
                    >
                      <Upload size={12} /> Import selection
                    </button>
                    <button onClick={() => setSelectedText('')} className="text-gray-400 dark:text-zinc-500 hover:text-white dark:hover:text-zinc-900 transition-colors ml-1">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reader/Live: error */}
          {!activeTab.loading && activeTab.page?.type === 'error' && (
            <div className="h-full flex flex-col items-center justify-center gap-5 text-center px-8 bg-[#fafafa] dark:bg-zinc-950">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                <ExternalLink size={20} className="text-gray-400 dark:text-zinc-500" />
              </div>
              <div className="space-y-1 max-w-sm">
                <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100">Page didn&apos;t load</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">{activeTab.page.error}</p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-[220px]">
                <button
                  onClick={() => { if (activeTab.page?.type === 'error') openExternal(activeTab.page.fallbackUrl) }}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gray-900 dark:bg-zinc-100 hover:bg-gray-700 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-sm font-medium rounded-xl transition-colors"
                >
                  <ExternalLink size={14} /> Open in tab
                </button>
                {activeTab.viewMode === 'reader' && (
                  <button onClick={() => switchMode('live')} className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 text-xs font-medium rounded-xl transition-colors">
                    <Monitor size={12} /> Try Live mode
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Live iframe */}
          {showIframe && !activeTab.loading && (
            <>
              <iframe
                key={activeTab.currentUrl}
                src={activeTab.currentUrl}
                className="absolute inset-0 w-full h-full border-0"
                title="browser"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
                onLoad={e => {
                  try {
                    const newUrl = (e.target as HTMLIFrameElement).contentWindow?.location?.href
                    if (newUrl && newUrl !== 'about:blank' && newUrl !== activeTab.currentUrl) {
                      updateTab(activeTab.id, { urlInput: newUrl, currentUrl: newUrl })
                      const tab = tabsRef.current.find(t => t.id === activeTab.id)
                      if (tab) {
                        const newHistory = [...tab.history.slice(0, tab.historyIndex + 1), newUrl]
                        updateTab(activeTab.id, { history: newHistory, historyIndex: newHistory.length - 1 })
                      }
                    }
                  } catch { /* cross-origin — can't read iframe URL */ }
                }}
              />
              {/* Bottom bar — helps when iframe fails silently */}
              <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none flex justify-center pb-4">
                <div className="pointer-events-auto flex items-center gap-3 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border border-gray-200 dark:border-zinc-700 rounded-xl shadow-md px-4 py-2.5">
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Page not loading?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => switchMode('reader')}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 text-xs font-medium rounded-lg transition-colors"
                    >
                      <AlignLeft size={12} /> Try Reader
                    </button>
                    <button
                      onClick={() => openExternal(activeTab.currentUrl)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-900 dark:bg-zinc-100 hover:bg-gray-700 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-medium rounded-lg transition-colors"
                    >
                      <ExternalLink size={12} /> Open in tab
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dispatch */}
      <aside className="w-[320px] shrink-0 h-full border-l border-gray-200 dark:border-zinc-700 overflow-hidden">
        <DispatchPanel context={dispatchContext} currentUrl={activeTab?.currentUrl ?? ''} />
      </aside>

      {/* Text selection import modal */}
      {showImportModal && selectedText && (
        <BrowserImportModal
          initialTitle={importModalTitle}
          initialDate={importModalDate}
          text={selectedText}
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            setShowImportModal(false)
            setSelectedText('')
            setImportDone(true)
          }}
        />
      )}
    </div>
  )
}


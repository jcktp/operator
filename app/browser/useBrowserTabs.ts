'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  type Tab, type BrowserBookmark, type PageResult, type ViewMode,
  makeTab, normalizeUrl, isYouTubeVideo, isYouTubeDomain, isSpotifyEmbed,
  isKnownIframeBlocked, saveTabs, loadSavedTabs,
} from './browserHelpers'

export function useBrowserTabs() {
  const [airGapped, setAirGapped] = useState(false)
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

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { settings?: Record<string, string> }) => {
        if (d.settings?.air_gap_mode === 'true') setAirGapped(true)
      })
      .catch(() => {})
  }, [])

  const updateTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }, [])

  const doFetch = useCallback(async (tabId: string, url: string, viewMode: ViewMode) => {
    setDispatchContext(`The user has the browser open at ${url}`)

    if (isYouTubeVideo(url)) {
      try {
        const res = await fetch('/api/browser/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
        if (!res.ok) throw new Error('fetch failed')
        const data = await res.json() as PageResult
        updateTab(tabId, { page: data, loading: false })
        setDispatchContext(`The user is watching a YouTube video at ${url}`)
      } catch {
        updateTab(tabId, { page: { type: 'error', error: 'Failed to load video', fallbackUrl: url }, loading: false })
      }
      return
    }
    if (isSpotifyEmbed(url)) {
      try {
        const res = await fetch('/api/browser/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
        if (!res.ok) throw new Error('fetch failed')
        const data = await res.json() as PageResult
        updateTab(tabId, { page: data, loading: false })
      } catch {
        updateTab(tabId, { page: { type: 'error', error: 'Failed to load embed', fallbackUrl: url }, loading: false })
      }
      return
    }
    if (isYouTubeDomain(url) && viewMode === 'live') {
      updateTab(tabId, { loading: false })
      return
    }
    if (viewMode === 'live' && isKnownIframeBlocked(url)) {
      const host = (() => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url } })()
      updateTab(tabId, {
        page: { type: 'error', error: `${host} blocks embedding in external apps. Open it in a tab to use it normally.`, fallbackUrl: url },
        loading: false,
      })
      return
    }
    if (viewMode === 'reader' || isYouTubeDomain(url)) {
      try {
        const res = await fetch('/api/browser/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
        if (!res.ok) throw new Error('fetch failed')
        const data = await res.json() as PageResult
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
      updateTab(tabId, { loading: false })
      setDispatchContext(`The user has the browser open at ${url}`)
    }
  }, [updateTab])

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

  // After mount: restore from sessionStorage
  useEffect(() => {
    setHydrated(true)
    const urlParam = new URLSearchParams(window.location.search).get('url')
    const saved = loadSavedTabs()

    if (urlParam) {
      const base = saved?.tabs ?? [makeTab()]
      const newTab = makeTab()
      const next = [...base, newTab]
      tabsRef.current = next
      setTabs(next)
      setActiveTabId(newTab.id)
      navigate(newTab.id, urlParam)
    } else if (saved) {
      setTabs(saved.tabs)
      setActiveTabId(saved.activeId)
      const active = saved.tabs.find(t => t.id === saved.activeId) ?? saved.tabs[0]
      if (active?.currentUrl) {
        setTimeout(() => doFetch(active.id, active.currentUrl, active.viewMode), 0)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (hydrated) saveTabs(tabs, activeTabId)
  }, [tabs, activeTabId, hydrated])

  // Sync dispatchContext when the active tab changes (tab switch doesn't call doFetch)
  useEffect(() => {
    const tab = tabs.find(t => t.id === activeTabId)
    if (!tab) return
    if (tab.page?.type === 'article') {
      setDispatchContext(`The user is reading: "${tab.page.title}" at ${tab.currentUrl}.\n\n${tab.page.text.slice(0, 3000)}`)
    } else if (tab.currentUrl) {
      setDispatchContext(`The user has the browser open at ${tab.currentUrl}`)
    } else {
      setDispatchContext('')
    }
  }, [activeTabId]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const navigateActive = useCallback((rawUrl: string) => {
    const active = tabsRef.current.find(t => t.id === activeTabId)
    if (active) navigate(active.id, rawUrl)
  }, [activeTabId, navigate])

  const switchMode = useCallback((mode: ViewMode) => {
    const tab = tabsRef.current.find(t => t.id === activeTabId)
    if (!tab || tab.viewMode === mode) return
    updateTab(tab.id, { viewMode: mode, page: null })
    if (tab.currentUrl) {
      updateTab(tab.id, { loading: true })
      doFetch(tab.id, tab.currentUrl, mode)
    }
  }, [activeTabId, updateTab, doFetch])

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

  const goBack = () => {
    const tab = tabsRef.current.find(t => t.id === activeTabId)
    if (!tab || tab.historyIndex <= 0) return
    const url = tab.history[tab.historyIndex - 1]
    updateTab(tab.id, { historyIndex: tab.historyIndex - 1 })
    navigate(tab.id, url)
  }

  const goForward = () => {
    const tab = tabsRef.current.find(t => t.id === activeTabId)
    if (!tab || tab.historyIndex >= tab.history.length - 1) return
    const url = tab.history[tab.historyIndex + 1]
    updateTab(tab.id, { historyIndex: tab.historyIndex + 1 })
    navigate(tab.id, url)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const tab = tabsRef.current.find(t => t.id === activeTabId)
    if (tab) navigate(tab.id, tab.urlInput)
  }

  const toggleBookmark = async () => {
    const active = tabsRef.current.find(t => t.id === activeTabId)
    if (!active?.currentUrl) return
    const existing = bookmarks.find(b => b.url === active.currentUrl)
    if (existing) {
      await fetch(`/api/browser/bookmarks?id=${existing.id}`, { method: 'DELETE' })
      setBookmarks(prev => prev.filter(b => b.id !== existing.id))
    } else {
      const title = (active.page?.type === 'article' ? active.page.title : null) || active.currentUrl
      const favicon = active.page?.type === 'article' ? active.page.favicon : null
      const res = await fetch('/api/browser/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: active.currentUrl, title, favicon }),
      })
      if (!res.ok) return
      const data = await res.json() as { bookmark?: BrowserBookmark }
      if (data.bookmark) setBookmarks(prev => [data.bookmark!, ...prev])
    }
  }

  const importToOperator = async () => {
    const active = tabsRef.current.find(t => t.id === activeTabId)
    if (!active?.currentUrl) return
    setImporting(true)
    try {
      const title = (active.page?.type === 'article' ? active.page.title : null) || active.currentUrl
      const text = (active.viewMode === 'reader' && active.page?.type === 'article')
        ? active.page.text
        : `Source: ${active.currentUrl}`
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
    const active = tabsRef.current.find(t => t.id === activeTabId)
    const title = (active?.page?.type === 'article' ? active.page.title : null)
    setImportModalTitle(title ? `Selection: ${title}` : `Selection from ${active?.currentUrl ?? ''}`)
    setImportModalDate(new Date().toISOString().slice(0, 10))
    setShowImportModal(true)
  }

  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0]

  return {
    // State
    airGapped, tabs, activeTabId, setActiveTabId,
    bookmarks, showBookmarks, setShowBookmarks,
    importing, importDone,
    selectedText, setSelectedText,
    showImportModal, setShowImportModal,
    importModalTitle, importModalDate,
    dispatchContext,
    // Refs
    bookmarkPanelRef, tabsRef,
    // Derived
    activeTab,
    // Setters
    setImportDone,
    // Actions
    updateTab, addTab, closeTab,
    navigate, navigateActive, switchMode,
    goBack, goForward, handleSubmit,
    toggleBookmark, importToOperator,
    handleTextSelect, openSelectionModal,
  }
}

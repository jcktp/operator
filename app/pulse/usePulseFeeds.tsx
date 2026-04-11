'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSettings } from '@/lib/use-settings'

export interface PulseItem {
 id: string
 title: string
 url: string | null
 summary: string | null
 publishedAt: string | null
 savedToJournal: boolean
 feedId: string
}

export interface PulseFeed {
 id: string
 name: string
 url: string
 type: string
 enabled: boolean
 lastFetched: string | null
 items: PulseItem[]
}

export function usePulseFeeds(hasDefaultFeeds: boolean) {
 const { settings } = useSettings()
 const bskyConfigured = !!(settings.bluesky_identifier && settings.bluesky_app_password)

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
 const [clearingId, setClearingId] = useState<string | null>(null)
 const [editingId, setEditingId] = useState<string | null>(null)
 const [editForm, setEditForm] = useState({ name: '', url: '', type: '' })
 const [savingEdit, setSavingEdit] = useState(false)
 const [showDirectory, setShowDirectory] = useState(false)
 const [dirCategory, setDirCategory] = useState('All')
 const [addingFromDir, setAddingFromDir] = useState<Set<string>>(new Set())
 const [autoRefreshMinutes, setAutoRefreshMinutes] = useState<number>(() => {
 if (typeof window !== 'undefined') return parseInt(localStorage.getItem('pulse_autorefresh') ?? '0') || 0
 return 0
 })
 const [autoRefreshing, setAutoRefreshing] = useState(false)
 const [lastAutoRefresh, setLastAutoRefresh] = useState<Date | null>(null)
 const feedsRef = useRef<PulseFeed[]>([])
 const [page, setPage] = useState(1)
 const ITEMS_PER_PAGE = 20
 const [keywords, setKeywords] = useState<string[]>(() => {
 if (typeof window === 'undefined') return []
 try { return JSON.parse(localStorage.getItem('pulse_keywords') ?? '[]') } catch { return [] }
 })
 const [keywordInput, setKeywordInput] = useState('')
 const [activeKeywords, setActiveKeywords] = useState<Set<string>>(new Set())
 const [savingFolder, setSavingFolder] = useState<Record<string, string>>({})

 const load = useCallback(async () => {
 const res = await fetch('/api/pulse')
 const data = await res.json() as { feeds: PulseFeed[] }
 const loaded = data.feeds ?? []
 setFeeds(loaded)
 feedsRef.current = loaded
 setLoading(false)
 }, [])

 useEffect(() => { load() }, [load])

 useEffect(() => {
 if (!hasDefaultFeeds) return
 fetch('/api/pulse/init-journalism', { method: 'POST' })
 .then(r => r.json())
 .then((d: { created?: number }) => { if ((d.created ?? 0) > 0) load() })
 .catch(() => {})
 }, [hasDefaultFeeds, load])

 useEffect(() => {
 if (typeof window !== 'undefined') localStorage.setItem('pulse_keywords', JSON.stringify(keywords))
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

 const baseItems = feeds
 .filter(f => f.enabled && (activeFeed === null || f.id === activeFeed))
 .flatMap(f => f.items.map(i => ({ ...i, feedName: f.name, feedType: f.type })))
 .sort((a, b) => {
 const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
 const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
 return tb - ta
 })

 const allItems = activeKeywords.size > 0 ? baseItems.filter(item => matchesKeywords(item)) : baseItems
 const existingUrls = new Set(feeds.map(f => f.url))

 const handleAdd = async (e: React.FormEvent) => {
 e.preventDefault()
 if (!form.name || !form.url) return
 setAdding(true)
 const res = await fetch('/api/pulse', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(form),
 })
 setAdding(false)
 if (!res.ok) {
 const d = await res.json().catch(() => ({})) as { error?: string }
 setRefreshError({ id: 'add', message: d.error ?? 'Failed to add feed' })
 return
 }
 setForm({ name: '', url: '', type: 'rss' })
 setShowAdd(false)
 await load()
 }

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
 const res = await fetch(`/api/pulse/${id}`, { method: 'DELETE' })
 setDeletingId(null)
 if (!res.ok) return
 if (activeFeed === id) setActiveFeed(null)
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
 const res = await fetch(`/api/pulse/${id}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(editForm),
 })
 setSavingEdit(false)
 if (!res.ok) return
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

 return {
 // State
 feeds, loading, showAdd, setShowAdd,
 activeFeed, setActiveFeed,
 refreshingId, refreshError,
 savingItemId, deletingId,
 form, setForm, adding,
 clearingId, editingId, setEditingId,
 editForm, setEditForm, savingEdit,
 showDirectory, setShowDirectory,
 dirCategory, setDirCategory,
 addingFromDir,
 autoRefreshMinutes, setAutoRefreshMinutes,
 autoRefreshing, lastAutoRefresh,
 page, setPage, ITEMS_PER_PAGE,
 keywords, setKeywords, keywordInput, setKeywordInput,
 activeKeywords, setActiveKeywords,
 savingFolder, setSavingFolder,
 // Derived
 allItems, existingUrls, bskyConfigured,
 // Actions
 refreshAll, highlightKeywords,
 handleAdd, handleAddFromDir, handleRefresh, handleDelete,
 handleClearFeed, startEdit, handleSaveEdit,
 handleSaveToJournal, handleUnsaveFromJournal,
 }
}

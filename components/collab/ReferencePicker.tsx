'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ReferenceItem {
  type: 'entity' | 'document' | 'timeline'
  id: string
  label: string
  meta?: string
}

interface Props {
  projectId: string
  onSelect: (item: ReferenceItem) => void
  onClose: () => void
}

type TabType = 'entity' | 'document' | 'timeline'

const TAB_LABELS: Record<TabType, string> = {
  entity:   'Entities',
  document: 'Documents',
  timeline: 'Timeline',
}

export default function ReferencePicker({ projectId, onSelect, onClose }: Props) {
  const [tab, setTab] = useState<TabType>('entity')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<ReferenceItem[]>([])
  const [loading, setLoading] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { searchRef.current?.focus() }, [])

  useEffect(() => {
    setLoading(true)
    const controller = new AbortController()
    fetch(`/api/collab/chat/${projectId}/references?type=${tab}&q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    })
      .then(r => r.json())
      .then((d: { items: ReferenceItem[] }) => { setItems(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))

    return () => controller.abort()
  }, [tab, query, projectId])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="absolute bottom-full left-0 mb-1 w-72 bg-[var(--surface)] border border-[var(--border)] rounded-[10px] shadow-xl z-50">
      {/* Tabs */}
      <div className="flex gap-0 border-b border-[var(--border)] px-2 pt-2">
        {(Object.keys(TAB_LABELS) as TabType[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setQuery('') }}
            className={cn(
              'px-2.5 py-1.5 text-xs font-medium rounded-t transition-colors',
              tab === t
                ? 'text-[var(--text-bright)] border-b-2 border-[var(--ink)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'
            )}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-[var(--border)]">
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${TAB_LABELS[tab].toLowerCase()}…`}
            className="w-full pl-7 pr-2 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[var(--border-mid)]"
          />
        </div>
      </div>

      {/* Results */}
      <div className="max-h-48 overflow-y-auto py-1">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={14} className="animate-spin text-[var(--border-mid)]" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-3 py-3 text-xs text-[var(--text-muted)] text-center">No {TAB_LABELS[tab].toLowerCase()} found</p>
        ) : (
          items.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => { onSelect(item); onClose() }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-[var(--surface-2)] transition-colors text-left"
            >
              <span className="truncate text-[var(--text-subtle)]">{item.label}</span>
              {item.meta && <span className="text-[10px] text-[var(--text-muted)] shrink-0 uppercase">{item.meta}</span>}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

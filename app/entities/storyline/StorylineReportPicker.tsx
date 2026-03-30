'use client'

import { useState } from 'react'
import { Search, Check } from 'lucide-react'
import { AreaBadge } from '@/components/Badge'

export interface PickerReport {
  id: string
  title: string
  area: string
  createdAt: string
}

interface Props {
  reports: PickerReport[]
  selected: string[]
  onChange: (ids: string[]) => void
}

export default function StorylineReportPicker({ reports, selected, onChange }: Props) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? reports.filter(r =>
        r.title.toLowerCase().includes(query.toLowerCase()) ||
        r.area.toLowerCase().includes(query.toLowerCase())
      )
    : reports

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 pointer-events-none" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search documents…"
          className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 bg-white dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
      </div>
      <div className="max-h-60 overflow-y-auto space-y-1 border border-gray-100 dark:border-zinc-800 rounded-lg p-1">
        {filtered.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-zinc-500 text-center py-4">No documents found</p>
        )}
        {filtered.map(r => {
          const isSelected = selected.includes(r.id)
          return (
            <button
              key={r.id}
              onClick={() => toggle(r.id)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
                isSelected
                  ? 'bg-gray-900 dark:bg-zinc-100'
                  : 'hover:bg-gray-50 dark:hover:bg-zinc-800'
              }`}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                isSelected
                  ? 'bg-white dark:bg-zinc-900 border-transparent'
                  : 'border-gray-300 dark:border-zinc-600'
              }`}>
                {isSelected && <Check size={10} className="text-gray-900 dark:text-zinc-100" />}
              </div>
              <AreaBadge area={r.area} />
              <span className={`flex-1 text-xs truncate ${isSelected ? 'text-white dark:text-zinc-900 font-medium' : 'text-gray-700 dark:text-zinc-300'}`}>
                {r.title}
              </span>
            </button>
          )
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-zinc-400">{selected.length} document{selected.length !== 1 ? 's' : ''} selected</p>
      )}
    </div>
  )
}

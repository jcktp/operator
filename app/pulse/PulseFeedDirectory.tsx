'use client'

import { Loader2 } from 'lucide-react'
import { PULSE_DIRECTORY, DIRECTORY_CATEGORIES } from '@/lib/pulse-directory'

interface Props {
  existingUrls: Set<string>
  dirCategory: string
  setDirCategory: (c: string) => void
  addingFromDir: Set<string>
  onAdd: (name: string, url: string) => void
}

export default function PulseFeedDirectory({ existingUrls, dirCategory, setDirCategory, addingFromDir, onAdd }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Feed directory</h2>
        <span className="text-xs text-gray-400">{PULSE_DIRECTORY.length} sources</span>
      </div>
      <div className="px-5 py-2.5 border-b border-gray-100 flex gap-1.5 flex-wrap">
        {DIRECTORY_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setDirCategory(cat)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              dirCategory === cat
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
        {PULSE_DIRECTORY.filter(e => dirCategory === 'All' || e.category === dirCategory).map(entry => {
          const alreadyAdded = existingUrls.has(entry.url)
          const isAdding = addingFromDir.has(entry.url)
          return (
            <div key={entry.url} className="flex items-center justify-between px-5 py-2.5 hover:bg-gray-50/60">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{entry.name}</span>
                  <span className="text-[11px] text-gray-400 border border-gray-200 rounded-full px-1.5 py-px">{entry.category}</span>
                </div>
              </div>
              <button
                disabled={alreadyAdded || isAdding}
                onClick={() => onAdd(entry.name, entry.url)}
                className={`ml-3 shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                  alreadyAdded
                    ? 'border-green-200 text-green-600 bg-green-50 cursor-default'
                    : isAdding
                    ? 'border-gray-200 text-gray-400 cursor-wait'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {isAdding ? <Loader2 size={11} className="animate-spin" /> : alreadyAdded ? 'Added' : 'Add'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

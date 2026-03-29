'use client'

import { useState, useEffect, useRef } from 'react'
import { Globe, Upload } from '@/components/icons'
import { Bookmark, AlignLeft, Monitor, Search } from 'lucide-react'
import type { BrowserBookmark } from './browserHelpers'

interface Props {
  onNavigate: (url: string) => void
  bookmarks: BrowserBookmark[]
}

export default function BrowserStartPage({ onNavigate, bookmarks }: Props) {
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

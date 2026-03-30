'use client'

import { useEffect, useRef, useState } from 'react'
import type { TimelineJSData } from './timelineUtils'

export type { TimelineJSData }

interface Props {
  data: TimelineJSData
}

declare global {
  interface Window {
    TL?: {
      Timeline: new (
        container: HTMLElement,
        data: TimelineJSData,
        options?: Record<string, unknown>
      ) => { destroy?: () => void }
    }
  }
}

export default function TimelineJSViewer({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<{ destroy?: () => void } | null>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load TimelineJS via DOM injection — avoids React 19 <script> tag warning
  useEffect(() => {
    if (window.TL) { setScriptLoaded(true); return }
    const existing = document.querySelector('script[src="/timelinejs/timeline.js"]')
    if (existing) {
      existing.addEventListener('load', () => setScriptLoaded(true))
      return
    }
    const script = document.createElement('script')
    script.src = '/timelinejs/timeline.js'
    script.onload = () => setScriptLoaded(true)
    script.onerror = () => setError('Failed to load timeline script.')
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || data.events.length === 0) return

    if (timelineRef.current?.destroy) {
      try { timelineRef.current.destroy() } catch {}
    }

    if (!window.TL) {
      setError('TimelineJS did not load correctly.')
      return
    }

    try {
      timelineRef.current = new window.TL.Timeline(containerRef.current, data, {
        timenav_position: 'bottom',
        start_at_slide: 0,
        default_bg_color: { r: 255, g: 255, b: 255 },
        font: 'default',
      })
    } catch (e) {
      setError('Could not render timeline: ' + (e instanceof Error ? e.message : String(e)))
    }

    return () => {
      if (timelineRef.current?.destroy) {
        try { timelineRef.current.destroy() } catch {}
      }
    }
  }, [scriptLoaded, data])

  if (data.events.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-12">
        No dateable events to display — events need a recognisable year to appear on the timeline.
      </p>
    )
  }

  return (
    <>
      <link rel="stylesheet" href="/timelinejs/timeline.css" />
      {error && (
        <p className="text-sm text-red-500 text-center py-4">{error}</p>
      )}
      <div
        ref={containerRef}
        id="timeline-embed"
        style={{ width: '100%', height: '600px' }}
        className="rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700"
      />
    </>
  )
}

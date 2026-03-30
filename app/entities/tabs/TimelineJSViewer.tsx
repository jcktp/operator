'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'

interface TLDate {
  year: string
  month?: string
  day?: string
}

interface TLEvent {
  start_date: TLDate
  text: { headline: string; text?: string }
  group?: string
}

export interface TimelineJSData {
  events: TLEvent[]
}

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

function parseTLDate(sortKey: string | null, dateText: string): TLDate | null {
  if (sortKey) {
    const parts = sortKey.split('-')
    const year = parts[0]
    const month = parts[1]
    const day = parts[2]
    if (year && /^\d{4}$/.test(year)) {
      const result: TLDate = { year }
      if (month && /^\d{2}$/.test(month)) result.month = month
      if (day && /^\d{2}$/.test(day)) result.day = day
      return result
    }
  }
  // Try to extract a 4-digit year from dateText as fallback
  const m = dateText.match(/\b(1[0-9]{3}|20[0-9]{2})\b/)
  if (m) return { year: m[1] }
  return null
}

export function buildTimelineJSData(
  events: Array<{
    id: string
    dateText: string
    dateSortKey: string | null
    event: string
    reportTitle: string
    area: string
  }>
): TimelineJSData {
  const tlEvents: TLEvent[] = []
  for (const e of events) {
    const date = parseTLDate(e.dateSortKey, e.dateText)
    if (!date) continue
    tlEvents.push({
      start_date: date,
      text: {
        headline: e.event.length > 80 ? e.event.slice(0, 80) + '…' : e.event,
        text: `<p style="font-size:12px;color:#6b7280">${e.reportTitle}</p>`,
      },
      group: e.area,
    })
  }
  return { events: tlEvents }
}

export default function TimelineJSViewer({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<{ destroy?: () => void } | null>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || data.events.length === 0) return

    // Clean up any prior instance
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
      <Script
        src="/timelinejs/timeline.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
        onError={() => setError('Failed to load timeline script.')}
      />
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

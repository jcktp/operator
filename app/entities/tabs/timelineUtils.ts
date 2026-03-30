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

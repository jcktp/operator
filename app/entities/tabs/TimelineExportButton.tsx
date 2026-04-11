'use client'

import { Download } from 'lucide-react'
import type { TimelineEvent } from './CustomTimeline'

export default function TimelineExportButton({ events }: { events: TimelineEvent[] }) {
 const handleExport = () => {
 const header = ['Date', 'Event', 'Area', 'Document', 'Story']
 const rows = events.map(e => [
 e.dateText,
 e.event,
 e.area,
 e.reportTitle,
 e.storyName ?? '',
 ])

 const csv = [header, ...rows]
 .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
 .join('\n')

 const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
 const url = URL.createObjectURL(blob)
 const a = document.createElement('a')
 a.href = url
 a.download = `timeline-${new Date().toISOString().slice(0, 10)}.csv`
 a.click()
 URL.revokeObjectURL(url)
 }

 return (
 <button
 onClick={handleExport}
 title="Export timeline to CSV"
 className="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border border-[var(--border)] text-xs text-[var(--text-subtle)] hover:bg-[var(--surface-2)] hover:text-[var(--text-body)] transition-colors"
 >
 <Download size={12} />
 Export CSV
 </button>
 )
}

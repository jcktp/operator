'use client'

import { Download } from 'lucide-react'

export interface ExportRow {
  title: string
  area: string
  direct: string
  date: string
  health: number
  positiveMetrics: number
  negativeMetrics: number
  warningMetrics: number
  flags: number
  questions: number
}

export default function ExportButton({ rows, period }: { rows: ExportRow[]; period: string }) {
  function download() {
    const headers = ['Title', 'Area', 'Direct', 'Date', 'Health %', 'Positive Metrics', 'Negative Metrics', 'Warning Metrics', 'Flags', 'Questions']
    const escape = (v: string | number) => {
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [
      headers.join(','),
      ...rows.map(r => [r.title, r.area, r.direct, r.date, r.health, r.positiveMetrics, r.negativeMetrics, r.warningMetrics, r.flags, r.questions].map(escape).join(',')),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `operator-dashboard-${period}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={download}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg hover:border-gray-300 dark:hover:border-zinc-500 hover:text-gray-900 dark:hover:text-zinc-50 transition-colors"
    >
      <Download size={13} />
      Export CSV
    </button>
  )
}

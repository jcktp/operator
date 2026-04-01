'use client'

import { Download } from 'lucide-react'

interface EntityRow {
  name: string
  type: string
  count: number
  contexts: string[]
  reports: Array<{ id: string; title: string; area: string; createdAt: string }>
}

export default function EntitiesExportButton({ entities }: { entities: EntityRow[] }) {
  const handleExport = () => {
    const header = ['Name', 'Type', 'Document Count', 'Areas', 'First Context', 'Documents']
    const rows = entities.map(e => [
      e.name,
      e.type,
      e.count,
      [...new Set(e.reports.map(r => r.area))].join('; '),
      e.contexts[0] ?? '',
      e.reports.map(r => r.title).join('; '),
    ])

    const csv = [header, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `entities-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      title="Export entities to CSV"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
    >
      <Download size={12} />
      Export CSV
    </button>
  )
}

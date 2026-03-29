'use client'

import { useState } from 'react'
import { Loader2, RotateCcw, Download } from 'lucide-react'

interface AuditLog {
  id: string
  action: string
  detail: string | null
  createdAt: string
}

export default function AuditLogPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/audit')
      const data = await res.json() as { logs: AuditLog[] }
      setLogs(data.logs ?? [])
    } finally {
      setLoading(false)
    }
  }

  const exportCsv = () => {
    const header = 'Timestamp,Action,Detail'
    const rows = logs.map(log => {
      const ts = new Date(log.createdAt).toISOString()
      const detail = (log.detail ?? '').replace(/"/g, '""')
      return `"${ts}","${log.action}","${detail}"`
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `operator-audit-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Audit log</h2>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              title="Export as CSV"
              className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 flex items-center gap-1"
            >
              <Download size={11} />
              Export CSV
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={load}
            className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 flex items-center gap-1"
          >
            {loading ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
            Load
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-zinc-500">Click Load to view recent actions.</p>
      ) : (
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-2 text-xs py-1 border-b border-gray-50 dark:border-zinc-800 last:border-0">
              <span className="text-gray-400 dark:text-zinc-500 shrink-0 tabular-nums">{new Date(log.createdAt).toLocaleString()}</span>
              <span className="font-mono text-gray-700 dark:text-zinc-200 shrink-0">{log.action}</span>
              {log.detail && <span className="text-gray-400 dark:text-zinc-500 truncate">{log.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

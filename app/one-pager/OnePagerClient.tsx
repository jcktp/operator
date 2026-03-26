'use client'

import { useState } from 'react'
import { Printer, Download, Save, Check } from 'lucide-react'

interface Metric { label: string; value: string; status?: string }
interface Insight { type: string; text: string }
interface Question { text: string; why: string; priority: string }

export interface OnePagerClientReport {
  id: string
  title: string
  area: string
  summary: string | null
  metrics: Metric[]
  insights: Insight[]
  questions: Question[]
  directName?: string
  directTitle?: string
}

export default function OnePagerClient({
  reportCount,
  reports,
  weekLabel,
}: {
  reportCount: number
  reports?: OnePagerClientReport[]
  weekLabel?: string
}) {
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  const handleExport = () => {
    if (!reports?.length) return
    const heading = weekLabel ? `Executive One Pager — ${weekLabel}` : 'Executive One Pager'
    const lines: string[] = [heading, '='.repeat(heading.length), '']

    for (const r of reports) {
      const from = r.directName ? ` · ${r.directName}${r.directTitle ? `, ${r.directTitle}` : ''}` : ''
      lines.push(`[${r.area}${from}]`)
      lines.push(r.title)
      lines.push('')
      if (r.summary) { lines.push(r.summary); lines.push('') }

      if (r.metrics.length > 0) {
        lines.push('Metrics')
        for (const m of r.metrics) lines.push(`  ${m.label}: ${m.value}`)
        lines.push('')
      }

      const flags = r.insights.filter(i => i.type === 'risk' || i.type === 'anomaly')
      if (flags.length > 0) {
        lines.push('Flags')
        for (const f of flags) lines.push(`  [${f.type}] ${f.text}`)
        lines.push('')
      }

      const highQ = r.questions.filter(q => q.priority === 'high')
      if (highQ.length > 0) {
        lines.push('Key Questions')
        for (const q of highQ) lines.push(`  ? ${q.text}`)
        lines.push('')
      }

      lines.push('─'.repeat(50), '')
    }

    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const slug = heading.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    a.download = `${slug}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSaveAsReport = async () => {
    if (!reports?.length || saving || savedId) return
    setSaving(true)
    try {
      const res = await fetch('/api/one-pager/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ reports, weekLabel }),
      })
      const data = await res.json() as { reportId?: string }
      if (data.reportId) setSavedId(data.reportId)
    } catch {
      // silent — user can retry
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2 print:hidden">
      {savedId && (
        <a
          href={`/reports/${savedId}`}
          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium"
        >
          <Check size={12} />
          View saved report
        </a>
      )}
      {reports && (
        <>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-gray-300 hover:text-gray-900 transition-colors"
          >
            <Download size={14} />
            Export
          </button>
          <button
            onClick={handleSaveAsReport}
            disabled={saving || !!savedId}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-gray-300 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            {saving ? 'Saving…' : savedId ? 'Saved' : 'Save as Report'}
          </button>
        </>
      )}
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-gray-300 hover:text-gray-900 transition-colors"
      >
        <Printer size={14} />
        Print / PDF
      </button>
    </div>
  )
}

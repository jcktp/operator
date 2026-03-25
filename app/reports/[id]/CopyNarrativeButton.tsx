'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface Props {
  title: string
  area: string
  directName?: string
  reportDate?: string
  summary?: string
  metrics: Array<{ label: string; value: string; status?: string }>
  insights: Array<{ type: string; text: string }>
  questions: Array<{ text: string; priority: string }>
}

export default function CopyNarrativeButton({ title, area, directName, reportDate, summary, metrics, insights, questions }: Props) {
  const [copied, setCopied] = useState(false)

  const buildNarrative = () => {
    const lines: string[] = []

    lines.push(`# ${title}`)
    const meta = [area, directName, reportDate].filter(Boolean).join(' · ')
    if (meta) lines.push(meta)
    lines.push('')

    if (summary) {
      lines.push(summary)
      lines.push('')
    }

    if (metrics.length > 0) {
      lines.push('## Key Metrics')
      for (const m of metrics) {
        const flag = m.status === 'negative' ? ' ⚠' : m.status === 'positive' ? ' ✓' : ''
        lines.push(`- ${m.label}: ${m.value}${flag}`)
      }
      lines.push('')
    }

    const risks = insights.filter(i => i.type === 'risk' || i.type === 'anomaly')
    const opps = insights.filter(i => i.type === 'opportunity')
    const obs = insights.filter(i => i.type === 'observation')

    if (risks.length > 0) {
      lines.push('## Flags')
      for (const i of risks) lines.push(`- ${i.text}`)
      lines.push('')
    }

    if (opps.length > 0) {
      lines.push('## Opportunities')
      for (const i of opps) lines.push(`- ${i.text}`)
      lines.push('')
    }

    if (obs.length > 0) {
      lines.push('## Observations')
      for (const i of obs) lines.push(`- ${i.text}`)
      lines.push('')
    }

    const highQ = questions.filter(q => q.priority === 'high')
    if (highQ.length > 0) {
      lines.push('## Questions to Ask')
      for (const q of highQ) lines.push(`- ${q.text}`)
      lines.push('')
    }

    return lines.join('\n').trim()
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildNarrative())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy narrative"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors"
    >
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
      {copied ? 'Copied!' : 'Copy narrative'}
    </button>
  )
}

'use client'

import { FileDown } from 'lucide-react'

interface Metric { label: string; value: string; context?: string; status?: string }
interface Insight { type: string; text: string; area?: string }
interface Question { text: string; why: string; priority: string }

interface Props {
  title: string
  area: string
  directName?: string
  reportDate?: string
  summary?: string
  metrics: Metric[]
  insights: Insight[]
  questions: Question[]
}

export default function ExportAnalysisPDFButton({ title, area, directName, reportDate, summary, metrics, insights, questions }: Props) {
  const handleExport = () => {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const metricsHtml = metrics.length > 0
      ? `<section><h2>Metrics</h2><table>${metrics.map(m => `<tr><td class="metric-label">${esc(m.label)}${m.context ? `<br><span class="metric-context">${esc(m.context)}</span>` : ''}</td><td class="metric-value">${esc(m.value)}</td></tr>`).join('')}</table></section>`
      : ''

    const flagTypeLabel: Record<string, string> = { risk: 'Risk', anomaly: 'Anomaly', observation: 'Observation', opportunity: 'Opportunity' }
    const insightsHtml = insights.length > 0
      ? `<section><h2>Flags &amp; Insights</h2>${insights.map(i => `<div class="insight-row"><span class="insight-type type-${esc(i.type)}">${esc(flagTypeLabel[i.type] ?? i.type)}</span><span class="insight-text">${esc(i.text)}</span></div>`).join('')}</section>`
      : ''

    const priorityLabel: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' }
    const questionsHtml = questions.length > 0
      ? `<section><h2>Questions</h2>${questions.map(q => `<div class="question-block"><div class="question-header"><span class="question-text">${esc(q.text)}</span><span class="question-priority prio-${esc(q.priority)}">${esc(priorityLabel[q.priority] ?? q.priority)}</span></div><div class="question-why">${esc(q.why)}</div></div>`).join('')}</section>`
      : ''

    const metaLine = [directName, reportDate].filter((s): s is string => Boolean(s)).map(esc).join(' &middot; ')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #111; background: #fff; padding: 36px 44px; line-height: 1.5; }
      .report-area { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 6px; }
      h1 { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 4px; }
      .meta { font-size: 11px; color: #9ca3af; margin-bottom: 20px; }
      .summary { font-size: 12px; color: #374151; line-height: 1.7; margin-bottom: 20px; padding: 14px 16px; background: #f9fafb; border-left: 3px solid #d1d5db; border-radius: 0 6px 6px 0; }
      section { margin-bottom: 20px; page-break-inside: avoid; }
      h2 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #9ca3af; margin-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; }
      tr { border-bottom: 1px solid #f3f4f6; }
      tr:last-child { border-bottom: none; }
      td { padding: 5px 0; vertical-align: top; }
      .metric-label { color: #374151; width: 65%; }
      .metric-context { font-size: 10px; color: #9ca3af; }
      .metric-value { font-weight: 600; color: #111; text-align: right; }
      .insight-row { display: flex; align-items: flex-start; gap: 8px; padding: 5px 0; border-bottom: 1px solid #f3f4f6; }
      .insight-row:last-child { border-bottom: none; }
      .insight-type { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 1px 6px; border-radius: 3px; white-space: nowrap; margin-top: 1px; }
      .type-risk { background: #fef2f2; color: #dc2626; }
      .type-anomaly { background: #fff7ed; color: #ea580c; }
      .type-observation { background: #eff6ff; color: #2563eb; }
      .type-opportunity { background: #f0fdf4; color: #16a34a; }
      .insight-text { color: #374151; flex: 1; }
      .question-block { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
      .question-block:last-child { border-bottom: none; }
      .question-header { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; margin-bottom: 3px; }
      .question-text { font-weight: 600; color: #111; flex: 1; }
      .question-priority { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 1px 6px; border-radius: 3px; white-space: nowrap; margin-top: 1px; }
      .prio-high { background: #fef2f2; color: #dc2626; }
      .prio-medium { background: #fffbeb; color: #d97706; }
      .prio-low { background: #f9fafb; color: #6b7280; }
      .question-why { font-size: 11px; color: #6b7280; line-height: 1.5; }
      @media print { body { padding: 0; } }
    </style></head><body>
      <div class="report-area">${esc(area)}</div>
      <h1>${esc(title)}</h1>
      ${metaLine ? `<div class="meta">${metaLine}</div>` : ''}
      ${summary ? `<p class="summary">${esc(summary)}</p>` : ''}
      ${metricsHtml}${insightsHtml}${questionsHtml}
    </body></html>`

    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 300)
  }

  return (
    <button
      onClick={handleExport}
      title="Export analysis as PDF"
      className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-zinc-50 hover:border-gray-300 dark:hover:border-zinc-600 transition-colors"
    >
      <FileDown size={13} />
      Export PDF
    </button>
  )
}

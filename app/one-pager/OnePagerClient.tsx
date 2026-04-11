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

 const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

 const sections = reports.map(r => {
 const from = r.directName ? ` &middot; ${esc(r.directName)}${r.directTitle ? `, ${esc(r.directTitle)}` : ''}` : ''
 const metricsHtml = r.metrics.length > 0
 ? `<div class="section-block"><div class="block-label">Metrics</div>${r.metrics.map(m => `<div class="metric-row"><span class="metric-label">${esc(m.label)}</span><span class="metric-value">${esc(m.value)}</span></div>`).join('')}</div>`
 : ''
 const flags = r.insights.filter(i => i.type === 'risk' || i.type === 'anomaly')
 const flagsHtml = flags.length > 0
 ? `<div class="section-block"><div class="block-label">Flags</div>${flags.map(f => `<div class="flag-row"><span class="flag-type">${esc(f.type)}</span><span class="flag-text">${esc(f.text)}</span></div>`).join('')}</div>`
 : ''
 const highQ = r.questions.filter(q => q.priority === 'high')
 const questionsHtml = highQ.length > 0
 ? `<div class="section-block"><div class="block-label">Key Questions</div>${highQ.map(q => `<div class="question-row">${esc(q.text)}</div>`).join('')}</div>`
 : ''
 return `<div class="report-section">
 <div class="report-meta">${esc(r.area)}${from}</div>
 <div class="report-title">${esc(r.title)}</div>
 ${r.summary ? `<p class="report-summary">${esc(r.summary)}</p>` : ''}
 ${metricsHtml}${flagsHtml}${questionsHtml}
 </div>`
 }).join('')

 const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(heading)}</title><style>
 * { box-sizing: border-box; margin: 0; padding: 0; }
 body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #111; background: #fff; padding: 32px 40px; line-height: 1.5; }
 h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; color: #111; }
 .week-label { font-size: 12px; color: #888; margin-bottom: 28px; }
 .report-section { margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #e5e7eb; page-break-inside: avoid; }
 .report-section:last-child { border-bottom: none; }
 .report-meta { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; font-weight: 600; margin-bottom: 4px; }
 .report-title { font-size: 14px; font-weight: 600; color: #111; margin-bottom: 8px; }
 .report-summary { font-size: 12px; color: #374151; margin-bottom: 12px; line-height: 1.6; }
 .section-block { margin-bottom: 10px; }
 .block-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; margin-bottom: 5px; }
 .metric-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6; }
 .metric-label { color: #374151; }
 .metric-value { font-weight: 600; color: #111; }
 .flag-row { display: flex; align-items: flex-start; gap: 8px; padding: 3px 0; }
 .flag-type { font-size: 10px; font-weight: 700; text-transform: uppercase; background: #fef2f2; color: #dc2626; padding: 1px 5px; border-radius: 3px; white-space: nowrap; margin-top: 1px; }
 .question-row { padding: 3px 0; color: #374151; }
 .question-row::before { content: '? '; color: #6b7280; font-weight: 700; }
 @media print { body { padding: 0; } }
 </style></head><body>
 <h1>${esc(heading)}</h1>
 ${weekLabel ? `<div class="week-label">${esc(weekLabel)}</div>` : '<div class="week-label"></div>'}
 ${sections}
 </body></html>`

 const win = window.open('', '_blank', 'width=900,height=700')
 if (!win) return
 win.document.write(html)
 win.document.close()
 win.focus()
 setTimeout(() => { win.print() }, 300)
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
 className="flex items-center gap-1 text-xs text-[var(--green)] hover:text-green-700 font-medium"
 >
 <Check size={12} />
 View saved report
 </a>
 )}
 {reports && (
 <>
 <button
 onClick={handleExport}
 className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-[4px] border border-[var(--border)] text-[var(--text-body)] hover:border-[var(--border)] hover:text-[var(--text-bright)] transition-colors"
 >
 <Download size={14} />
 Export PDF
 </button>
 <button
 onClick={handleSaveAsReport}
 disabled={saving || !!savedId}
 className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-[4px] border border-[var(--border)] text-[var(--text-body)] hover:border-[var(--border)] hover:text-[var(--text-bright)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <Save size={14} />
 {saving ? 'Saving…' : savedId ? 'Saved' : 'Save as Report'}
 </button>
 </>
 )}
 <button
 onClick={() => window.print()}
 className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-[4px] border border-[var(--border)] text-[var(--text-body)] hover:border-[var(--border)] hover:text-[var(--text-bright)] transition-colors"
 >
 <Printer size={14} />
 Print / PDF
 </button>
 </div>
 )
}

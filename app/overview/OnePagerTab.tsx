import Link from 'next/link'
import { AreaBadge } from '@/components/Badge'
import { formatRelativeDate } from '@/lib/utils'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import OnePagerClient from '@/app/one-pager/OnePagerClient'
import { getModeConfig } from '@/lib/mode'
import { getReportLabels } from '@/lib/mode-labels'

interface Metric { label: string; value: string; status?: string }
interface Insight { type: string; text: string }
interface Question { text: string; why: string; priority: string }

export interface OnePagerReport {
 id: string
 title: string
 area: string
 summary: string | null
 metrics: Metric[]
 insights: Insight[]
 questions: Question[]
 createdAt: string
 directName?: string
 directTitle?: string
}

interface Props {
 reports: OnePagerReport[]
 weekIndex: number
 totalWeeks: number
 weekLabel: string
 modeId?: string
}

export default function OnePagerTab({ reports, weekIndex, totalWeeks, weekLabel, modeId }: Props) {
 const modeConfig = getModeConfig(modeId)
 const labels = getReportLabels(modeId)
 const prevHref = weekIndex < totalWeeks - 1 ? `/?tab=one-pager&week=${weekIndex + 1}` : null
 const nextHref = weekIndex > 0 ? `/?tab=one-pager&week=${weekIndex - 1}` : null

 return (
 <div className="max-w-4xl space-y-6">
 {/* Header */}
 <div className="flex items-start justify-between">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <Link
 href="/"
 className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-subtle)] transition-colors"
 >
 <ArrowLeft size={11} /> Overview
 </Link>
 </div>
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">One Pager</h1>
 <p className="text-[var(--text-muted)] text-sm mt-0.5">{reports.length} {reports.length !== 1 ? modeConfig.documentLabelPlural.toLowerCase() : modeConfig.documentLabel.toLowerCase()}</p>
 </div>
 <div className="flex items-center gap-2">
 {/* Week navigation */}
 <div className="flex items-center gap-1 border border-[var(--border)] rounded-[4px] overflow-hidden text-sm">
 {prevHref ? (
 <Link href={prevHref} className="px-2 py-1.5 hover:bg-[var(--surface-2)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-bright)]">
 <ChevronLeft size={14} />
 </Link>
 ) : (
 <span className="px-2 py-1.5 text-[var(--border)] cursor-not-allowed"><ChevronLeft size={14} /></span>
 )}
 <span className="px-3 py-1.5 text-xs font-medium text-[var(--text-body)] border-x border-[var(--border)]">{weekLabel}</span>
 {nextHref ? (
 <Link href={nextHref} className="px-2 py-1.5 hover:bg-[var(--surface-2)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-bright)]">
 <ChevronRight size={14} />
 </Link>
 ) : (
 <span className="px-2 py-1.5 text-[var(--border)] cursor-not-allowed"><ChevronRight size={14} /></span>
 )}
 </div>
 <OnePagerClient reportCount={reports.length} reports={reports} weekLabel={weekLabel} />
 </div>
 </div>

 {reports.length === 0 ? (
 <div className="text-center py-16 text-[var(--text-muted)] text-sm">No {modeConfig.documentLabelPlural.toLowerCase()} for this period.</div>
 ) : (
 <div className="space-y-6 print:space-y-8">
 {reports.map((r, i) => (
 <div
 key={r.id}
 className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-6 print:border-[var(--border)] print:rounded-none print:break-inside-avoid"
 >
 <div className="flex items-start justify-between mb-4">
 <div className="flex items-center gap-2 flex-wrap">
 <AreaBadge area={r.area} />
 {r.directName && (
 <span className="text-xs text-[var(--text-muted)]">{r.directName}{r.directTitle ? ` · ${r.directTitle}` : ''}</span>
 )}
 </div>
 <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] shrink-0">
 <span>#{i + 1}</span>
 <span>{formatRelativeDate(new Date(r.createdAt))}</span>
 </div>
 </div>

 <h2 className="text-base font-semibold text-[var(--text-bright)] mb-2">{r.title}</h2>

 {r.summary && (
 <p className="text-sm text-[var(--text-subtle)] leading-relaxed mb-4">{r.summary}</p>
 )}

 {r.metrics.length > 0 && (
 <div className="mb-4">
 <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{labels.onePagerMetrics}</p>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
 {r.metrics.map((m, mi) => (
 <div key={mi} className={`rounded-[4px] px-3 py-2 ${
 m.status === 'positive' ? 'bg-[var(--green-dim)]' :
 m.status === 'negative' ? 'bg-[var(--red-dim)]' :
 m.status === 'warning' ? 'bg-[var(--amber-dim)]' : 'bg-[var(--surface-2)]'
 }`}>
 <p className="text-xs text-[var(--text-muted)] truncate">{m.label}</p>
 <p className={`text-sm font-semibold mt-0.5 ${
 m.status === 'positive' ? 'text-[var(--green)]' :
 m.status === 'negative' ? 'text-[var(--red)]' :
 m.status === 'warning' ? 'text-[var(--amber)]' : 'text-[var(--text-bright)]'
 }`}>{m.value}</p>
 </div>
 ))}
 </div>
 </div>
 )}

 {r.insights.filter(ins => ins.type === 'risk' || ins.type === 'anomaly').length > 0 && (
 <div className="mb-3">
 <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{labels.onePagerFlags}</p>
 <div className="space-y-1">
 {r.insights.filter(ins => ins.type === 'risk' || ins.type === 'anomaly').map((ins, ii) => (
 <div key={ii} className="flex items-start gap-2 text-sm">
 <span className={`font-bold text-xs mt-0.5 shrink-0 ${ins.type === 'risk' ? 'text-[var(--red)]' : 'text-amber-500'}`}>
 {ins.type === 'risk' ? '⚠' : '!'}
 </span>
 <span className="text-[var(--text-body)]">{ins.text}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {r.questions.filter(q => q.priority === 'high').length > 0 && (
 <div>
 <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{labels.onePagerQuestions}</p>
 <div className="space-y-1">
 {r.questions.filter(q => q.priority === 'high').map((q, qi) => (
 <p key={qi} className="text-sm text-[var(--text-body)]">? {q.text}</p>
 ))}
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 )
}

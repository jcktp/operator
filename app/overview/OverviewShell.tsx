'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { AreaBadge, InsightTypeBadge, StatusBadge } from '@/components/Badge'
import { ArrowRight, Upload, AlertTriangle, HelpCircle, CheckCircle2, FileStack, Loader2, X, Wand2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useDispatch } from '@/components/DispatchContext'
import { useMode } from '@/components/ModeContext'
import { getReportLabels } from '@/lib/mode-labels'
import { MetricsChartsSection } from '@/components/MetricsCharts'
import type { AreaMetricData } from '@/components/MetricsCharts'
import PeriodDropdown from '@/components/PeriodDropdown'

const DispatchPanel = dynamic(() => import('@/app/dispatch/DispatchPanel'), { ssr: false })


// ── Serialised data shapes ───────────────────────────────────────────────────

export interface SerializedAreaReport {
 id: string
 area: string
 title: string
 summary: string | null
 metrics: Array<{ label: string; value: string; status?: string }>
 createdAt: string
}

export interface FlagItem {
 text: string; type: string; reportTitle: string; reportId: string
}

export interface QuestionItem {
 text: string; reportTitle: string; directName?: string; reportId: string
}

export interface ResolvedFlagItem {
 text: string; area: string; reportId: string
}

export interface RecentReport {
 id: string; title: string; area: string; createdAt: string
 directName?: string; directTitle?: string
}

export interface OverviewData {
 stats: { totalReports: number; areasCount: number; directsCount: number }
 areas: Array<{ name: string; count: number }>
 selectedArea?: string
 activeAreas: SerializedAreaReport[]
 topInsights: FlagItem[]
 topQuestions: QuestionItem[]
 resolvedFlagItems: ResolvedFlagItem[]
 recentReports: RecentReport[]
 context: string
 areaMetrics?: AreaMetricData[]
}

// ── Shell ────────────────────────────────────────────────────────────────────

export default function OverviewShell({ data, activeFrom, activeTo }: { data: OverviewData; activeFrom?: string; activeTo?: string }) {
 const { setAiContext } = useDispatch()
 const mode = useMode()
 const labels = getReportLabels(mode.id)
 const { stats, areas, selectedArea, activeAreas, topInsights, topQuestions, resolvedFlagItems, recentReports, context, areaMetrics } = data

 function areaHref(area?: string) {
 const p = new URLSearchParams()
 if (area) p.set('area', area)
 if (activeFrom) p.set('from', activeFrom)
 if (activeTo) p.set('to', activeTo)
 const q = p.toString()
 return q ? `/?${q}` : '/'
 }

 const [catchMeUpOpen, setCatchMeUpOpen] = useState(false)
 const [catchMeUpLoading, setCatchMeUpLoading] = useState(false)
 const [catchMeUpText, setCatchMeUpText] = useState<string | null>(null)

 useEffect(() => {
 setAiContext(context)
 }, [context, setAiContext])

 const handleCatchMeUp = async () => {
 setCatchMeUpOpen(true)
 if (catchMeUpText) return
 setCatchMeUpLoading(true)
 try {
 const res = await fetch('/api/catch-me-up')
 if (!res.ok) throw new Error(`HTTP ${res.status}`)
 const data = await res.json() as { digest: string }
 setCatchMeUpText(data.digest ?? 'No digest returned.')
 } catch {
 setCatchMeUpText('Unable to generate digest. Check your AI provider settings.')
 } finally {
 setCatchMeUpLoading(false)
 }
 }

 return (
 <div className="flex flex-col flex-1 min-h-0">

 {/* Fixed header — never scrolls */}
 <div className="shrink-0 py-4 border-b border-[var(--border)] flex items-center justify-between gap-4">
 <div>
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Overview</h1>
 <p className="text-[var(--text-muted)] text-sm mt-0.5">
 {stats.totalReports} {stats.totalReports !== 1 ? mode.documentLabelPlural.toLowerCase() : mode.documentLabel.toLowerCase()} across {stats.areasCount} {stats.areasCount !== 1 ? mode.collectionLabelPlural.toLowerCase() : mode.collectionLabel.toLowerCase()}
 {stats.directsCount > 0 && ` · ${stats.directsCount} ${stats.directsCount !== 1 ? mode.personLabelPlural.toLowerCase() : mode.personLabel.toLowerCase()}`}
 </p>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <PeriodDropdown activeFrom={activeFrom} activeTo={activeTo} basePath="/" />
 <Button variant="outline"size="sm"onClick={handleCatchMeUp}>
 <Wand2 size={13} />
 Catch me up
 </Button>
 <Link href="/?tab=one-pager"className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-[4px] border border-[var(--border-mid)] text-[var(--text-body)] hover:bg-[var(--ink)] hover:text-white hover:border-[var(--ink)] transition-colors">
 <FileStack size={13} />
 One Pager
 </Link>
 <Link href="/upload"className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-[4px] bg-[var(--ink)] text-white hover:bg-[#333] transition-colors">
 <Upload size={13} />
 {mode.navDocuments}
 </Link>
 </div>
 </div>

 {/* Body: persistent sidebar + scrollable content + dispatch */}
 <div className="flex-1 min-h-0 flex">

 {/* Persistent left sidebar — never scrolls */}
 {areas.length >= 1 && (
 <aside className="w-48 shrink-0 border-r border-[var(--border)] overflow-y-auto py-5 -ml-6 sm:-ml-8">
 <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] px-5 pb-3">Areas</p>
 <Link
 href={areaHref()}
 className={cn(
 'flex items-center justify-between px-5 py-2 text-sm transition-colors border-l-2',
 !selectedArea
 ? 'border-l-[var(--blue)] bg-[rgba(46,76,166,0.05)] text-[var(--ink)] font-semibold dark:bg-[rgba(46,76,166,0.12)]'
 : 'border-l-transparent text-[var(--text-subtle)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]'
 )}
 >
 <span>All areas</span>
 <span className={cn('text-xs font-mono', !selectedArea ? 'text-[var(--blue)] opacity-70' : 'text-[var(--text-muted)]')}>
 {areas.reduce((s, a) => s + a.count, 0)}
 </span>
 </Link>
 {areas.map(a => (
 <Link
 key={a.name}
 href={areaHref(a.name)}
 className={cn(
 'flex items-center justify-between px-5 py-2 text-sm transition-colors border-l-2',
 selectedArea === a.name
 ? 'border-l-[var(--blue)] bg-[rgba(46,76,166,0.05)] text-[var(--ink)] font-semibold dark:bg-[rgba(46,76,166,0.12)]'
 : 'border-l-transparent text-[var(--text-subtle)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]'
 )}
 >
 <span className="truncate">{a.name}</span>
 <span className={cn('text-xs font-mono shrink-0', selectedArea === a.name ? 'text-[var(--blue)] opacity-70' : 'text-[var(--text-muted)]')}>
 {a.count}
 </span>
 </Link>
 ))}
 </aside>
 )}

 {/* Scrollable content */}
 <div className="flex-1 min-w-0 overflow-y-auto">
 <div className="px-6 py-6 space-y-8">

 {/* Catch Me Up panel */}
 {catchMeUpOpen && (
 <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[10px] p-5 relative">
 <button
 onClick={() => setCatchMeUpOpen(false)}
 className="absolute top-3 right-3 p-1 text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors"
 >
 <X size={14} />
 </button>
 <div className="flex items-center gap-2 mb-3">
 <Wand2 size={13} className="text-[var(--text-muted)]" />
 <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em]">Catch me up</span>
 </div>
 {catchMeUpLoading ? (
 <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-4">
 <Loader2 size={14} className="animate-spin" />
 Generating digest…
 </div>
 ) : (
 <p className="text-sm text-[var(--text-body)] leading-relaxed whitespace-pre-wrap">{catchMeUpText}</p>
 )}
 </div>
 )}

 {/* Areas grid */}
 <section>
 <h2 className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] mb-3">
 {selectedArea ?? `By ${mode.collectionLabel}`}
 </h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
 {activeAreas.map(report => (
 <Link
 key={report.id}
 href={`/reports/${report.id}`}
 className="bg-[var(--surface)] border border-[var(--border)] border-l-[3px] border-l-[var(--border-mid)] rounded-[10px] p-4 hover:border-[var(--border-mid)] hover:border-l-[var(--ink)] hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)] transition-all group"
 >
 <div className="flex items-start justify-between mb-3">
 <AreaBadge area={report.area} />
 <span className="text-xs text-[var(--text-muted)] font-mono">{formatRelativeDate(new Date(report.createdAt))}</span>
 </div>
 <p className="text-sm text-[var(--text-body)] line-clamp-2 mb-3">{report.summary || report.title}</p>
 {report.metrics.length > 0 && (
 <div className="space-y-1.5 border-t border-[var(--border)] pt-3">
 {report.metrics.slice(0, 3).map((m, i) => (
 <div key={i} className="flex items-center justify-between">
 <span className="text-xs text-[var(--text-muted)] truncate max-w-[60%]">{m.label}</span>
 <div className="flex items-center gap-1">
 {m.status && m.status !== 'neutral' && (
 <StatusBadge status={m.status as 'positive' | 'negative' | 'warning'} />
 )}
 <span className="text-xs font-medium text-[var(--text-bright)]">{m.value}</span>
 </div>
 </div>
 ))}
 </div>
 )}
 <div className="mt-3 flex items-center gap-1 text-xs text-[var(--text-muted)] group-hover:text-[var(--text-subtle)] transition-colors">
 <span>View {mode.documentLabel.toLowerCase()}</span><ArrowRight size={11} />
 </div>
 </Link>
 ))}
 </div>
 </section>

 {/* Resolved flags */}
 {resolvedFlagItems.length > 0 && (
 <section>
 <h2 className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] mb-3 flex items-center gap-1.5">
 <CheckCircle2 size={11} className="text-[var(--green)]" />
 {labels.resolvedPanel}
 </h2>
 <div className="bg-[var(--green-dim)] border border-[var(--border)] rounded-[10px] divide-y divide-[var(--border)]">
 {resolvedFlagItems.map((f, i) => (
 <Link key={i} href={`/reports/${f.reportId}`}
 className="flex items-start gap-3 px-4 py-3 hover:bg-green-100/50/50 transition-colors">
 <CheckCircle2 size={14} className="text-[var(--green)] shrink-0 mt-0.5" />
 <div className="flex-1 min-w-0">
 <p className="text-sm text-green-800">{f.text}</p>
 <AreaBadge area={f.area} />
 </div>
 </Link>
 ))}
 </div>
 </section>
 )}

 {/* Metric trends */}
 {areaMetrics && areaMetrics.length > 0 && (
 <MetricsChartsSection areas={areaMetrics} />
 )}

 {/* Flags + Questions */}
 {(topInsights.length > 0 || topQuestions.length > 0) && (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {topInsights.length > 0 && (
 <section>
 <h2 className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] mb-3 flex items-center gap-1.5">
 <AlertTriangle size={11} /> {labels.flagsPanel}
 </h2>
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] divide-y divide-[var(--border)]">
 {topInsights.map((insight, i) => (
 <Link key={i} href={`/reports/${insight.reportId}`}
 className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors">
 <InsightTypeBadge type={insight.type as 'risk' | 'anomaly' | 'observation' | 'opportunity'} />
 <div className="flex-1 min-w-0">
 <p className="text-sm text-[var(--text-body)]">{insight.text}</p>
 <p className="text-xs text-[var(--text-muted)] mt-0.5">{insight.reportTitle}</p>
 </div>
 </Link>
 ))}
 </div>
 </section>
 )}
 {topQuestions.length > 0 && (
 <section>
 <h2 className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] mb-3 flex items-center gap-1.5">
 <HelpCircle size={11} /> {labels.questionsPanel}
 </h2>
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] divide-y divide-[var(--border)]">
 {topQuestions.map((q, i) => (
 <Link key={i} href={`/reports/${q.reportId}`}
 className="block px-4 py-3 hover:bg-[var(--surface-2)] transition-colors">
 <p className="text-sm text-[var(--text-bright)] font-medium">{q.text}</p>
 <p className="text-xs text-[var(--text-muted)] mt-0.5">
 {q.directName ? `${labels.questionsPersonPrefix} ${q.directName}` : q.reportTitle}
 </p>
 </Link>
 ))}
 </div>
 </section>
 )}
 </div>
 )}

 {/* Recent reports */}
 <section>
 <h2 className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] mb-3">Recent {mode.documentLabelPlural}</h2>
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] divide-y divide-[var(--border)]">
 {recentReports.map(report => (
 <Link key={report.id} href={`/reports/${report.id}`}
 className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-0.5 flex-wrap">
 <span className="text-sm font-medium text-[var(--text-bright)] truncate">{report.title}</span>
 <AreaBadge area={report.area} />
 </div>
 {report.directName && (
 <p className="text-xs text-[var(--text-muted)]">{report.directName} · {report.directTitle}</p>
 )}
 </div>
 <div className="flex items-center gap-3 shrink-0">
 <span className="text-xs text-[var(--text-muted)]">{formatRelativeDate(new Date(report.createdAt))}</span>
 <ArrowRight size={14} className="text-[var(--border-mid)]" />
 </div>
 </Link>
 ))}
 </div>
 </section>

 </div>
 </div>

 {/* Persistent dispatch panel */}
 <div className="w-72 shrink-0 border-l border-[var(--border)] flex flex-col -mr-6 sm:-mr-8">
 <div className="flex-1 min-h-0 overflow-hidden">
 <DispatchPanel
 context={context}
 currentProjectId={null}
 compact
 />
 </div>
 </div>

 </div>
 </div>
 )
}

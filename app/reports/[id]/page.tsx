import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { formatDate, formatRelativeDate, formatFileSize, cn, parseJsonSafe } from '@/lib/utils'
import type { Metric, Insight, Question } from '@/lib/utils'
import { getModeConfig } from '@/lib/mode'
import { getReportLabels } from '@/lib/mode-labels'
import { AreaBadge, InsightTypeBadge, StatusBadge } from '@/components/Badge'
import { ArrowLeft, ArrowRight, FileText, Calendar, User, HelpCircle, TrendingUp, AlertTriangle, GitCompare, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import DeleteReportButton from './DeleteButton'
import DispatchReportButton from './DispatchReportButton'
import ReportContent from './ReportContent'
import RawContent from './RawContent'
import CopyNarrativeButton from './CopyNarrativeButton'
import ExportAnalysisPDFButton from './ExportAnalysisPDFButton'
import ReanalyzeButton from './ReanalyzeButton'
import ReportNotesEditor from './ReportNotesEditor'
import EntitiesSection from './EntitiesSection'
import TimelineSection from './TimelineSection'
import RedactionsSection from './RedactionsSection'
import JournalismComparisonSection from './JournalismComparisonSection'
import VerificationSection from './VerificationSection'
import type { RedactionItem } from './RedactionsSection'
import type { JournalismComparisonData } from './JournalismComparisonSection'
import type { VerificationItem } from './VerificationSection'

interface ComparisonChange {
 metric: string
 previous: string
 current: string
 direction: 'improved' | 'declined' | 'unchanged' | 'new' | 'removed'
 significance: 'high' | 'medium' | 'low'
 note?: string
}

interface Comparison {
 headline: string
 changes: ComparisonChange[]
 newTopics: string[]
 removedTopics: string[]
}

export const dynamic = 'force-dynamic'

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params
 const report = await prisma.report.findUnique({
 where: { id },
 include: { directReport: true },
 })

 if (!report) notFound()

 // Fetch history for this area (most recent 6, excluding current)
 const [modeRow, projectSetting] = await Promise.all([
 prisma.setting.findUnique({ where: { key: 'app_mode' } }),
 prisma.setting.findUnique({ where: { key: 'current_project_id' } }),
 ])
 const currentProjectId = projectSetting?.value || null
 const projectFilter = currentProjectId ? { projectId: currentProjectId } : {}

 const currentProject = currentProjectId
 ? await prisma.project.findUnique({ where: { id: currentProjectId }, select: { name: true } })
 : null
 const currentProjectName = currentProject?.name ?? null

 const [history, prevReport, nextReport] = await Promise.all([
 prisma.report.findMany({
 where: { ...projectFilter, area: report.area, id: { not: id } },
 orderBy: { createdAt: 'desc' },
 take: 6,
 select: { id: true, title: true, createdAt: true, summary: true, comparison: true },
 }),
 prisma.report.findFirst({
 where: { ...projectFilter, createdAt: { lt: report.createdAt } },
 orderBy: { createdAt: 'desc' },
 select: { id: true, title: true, area: true },
 }),
 prisma.report.findFirst({
 where: { ...projectFilter, createdAt: { gt: report.createdAt } },
 orderBy: { createdAt: 'asc' },
 select: { id: true, title: true, area: true },
 }),
 ])
 const modeConfig = getModeConfig(modeRow?.value)
 const { entities: showEntities, timeline: showTimeline, redactions: showRedactions, verification: showVerification, documentComparison: showDocComparison, showReportMetrics } = modeConfig.features
 const labels = getReportLabels(modeConfig.id)

 // Cross-module jump hrefs — resolved per mode so they never point to a non-existent route
 const entitiesHref = showEntities ? '/entities?tab=entities' : null
 const timelineHref: string | null = (() => {
 if (!showTimeline) return null
 if (showEntities) return '/entities?tab=timeline'
 return modeConfig.features.extraNavItems.find(i => i.href === '/timeline')?.href ?? null
 })()

 // Optional features data
 const [entities, timelineEvents, journalismRow] = (showEntities || showTimeline || showRedactions || showVerification || showDocComparison)
 ? await Promise.all([
 prisma.reportEntity.findMany({ where: { reportId: id }, orderBy: { type: 'asc' } }),
 prisma.timelineEvent.findMany({
 where: { reportId: id },
 orderBy: [{ dateSortKey: 'asc' }, { createdAt: 'asc' }],
 }),
 prisma.reportJournalism.findUnique({ where: { reportId: id } }),
 ])
 : [[], [], null]

 // Cross-document entity linking
 type CrossDocResult = { name: string; type: string; reportIds: string[]; reportTitles: Record<string, string> }
 const crossLinks: CrossDocResult[] = []
 if (showEntities && entities.length > 0) {
 try {
 const linkableTypes = ['person', 'organisation', 'location']
 const linkableEntities = entities.filter(e => linkableTypes.includes(e.type))
 const uniqueNames = [...new Set(linkableEntities.map(e => e.name))]

 await Promise.all(uniqueNames.map(async (name) => {
 const others = await prisma.reportEntity.findMany({
 where: { name, reportId: { not: id } },
 select: { reportId: true },
 })
 if (others.length === 0) return
 const distinctReportIds = [...new Set(others.map(o => o.reportId))]
 const linkedReports = await prisma.report.findMany({
 where: { id: { in: distinctReportIds } },
 select: { id: true, title: true },
 orderBy: { createdAt: 'desc' },
 take: 5,
 })
 const entity = linkableEntities.find(e => e.name === name)
 crossLinks.push({
 name,
 type: entity?.type ?? 'person',
 reportIds: linkedReports.map(r => r.id),
 reportTitles: Object.fromEntries(linkedReports.map(r => [r.id, r.title])),
 })
 }))
 } catch (err) {
 console.error('Cross-link lookup failed:', err)
 }
 }

 // Parse journalism data
 const redactions = journalismRow ? parseJsonSafe<RedactionItem[]>(journalismRow.redactions, []) : []
 const journalismComparison = journalismRow ? parseJsonSafe<JournalismComparisonData | null>(journalismRow.journalismComparison, null) : null
 const verificationChecklist = journalismRow ? parseJsonSafe<VerificationItem[]>(journalismRow.verificationChecklist, []) : []

 const prevReportTitle = history[0]?.title

 const metrics = parseJsonSafe<Record<string, unknown>[]>(report.metrics, [])
 .map(m => ({ ...m, label: (((m.label ?? m.name) as string | undefined) ?? '').trim() }))
 .filter(m => m.label) as Metric[]
 const insights = parseJsonSafe<Insight[]>(report.insights, [])
 const questions = parseJsonSafe<Question[]>(report.questions, [])
 const comparison = parseJsonSafe<Comparison | null>(report.comparison, null)

 const highQuestions = questions.filter(q => q.priority === 'high')
 const otherQuestions = questions.filter(q => q.priority !== 'high')

 const directionIcon: Record<string, string> = {
 improved: '↑', declined: '↓', unchanged: '→', new: '+', removed: '–',
 }
 const directionColor: Record<string, string> = {
 improved: 'text-[var(--green)]',
 declined: 'text-[var(--red)]',
 unchanged: 'text-[var(--text-muted)]',
 new: 'text-blue-600',
 removed: 'text-[var(--text-muted)]',
 }

 const periodLabel = (() => {
 if (history.length === 0 || !comparison) return null
 const prev = new Date(history[0].createdAt)
 const curr = new Date(report.createdAt)
 const days = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
 if (days <= 10) return 'WoW'
 if (days <= 40) return 'MoM'
 if (days <= 100) return 'QoQ'
 return 'YoY'
 })()

 const changesByMetric = new Map(
 (comparison?.changes ?? []).filter(c => c.metric).map(c => [c.metric.toLowerCase(), c])
 )

 function ppDelta(prev?: string, curr?: string): string | null {
 if (!prev || !curr) return null
 if (!prev.includes('%') || !curr.includes('%')) return null
 const p = parseFloat(prev.replace(/[^0-9.-]/g, ''))
 const c = parseFloat(curr.replace(/[^0-9.-]/g, ''))
 if (isNaN(p) || isNaN(c)) return null
 const d = Math.round((c - p) * 10) / 10
 return (d > 0 ? '+' : '') + d + 'pp'
 }

 // ── Header ────────────────────────────────────────────────────────────────
 const header = (
 <>
 {/* Top row: back + action buttons */}
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1 min-w-0">
 <Link href="/library"className="inline-flex items-center gap-1.5 text-sm text-[var(--text-subtle)] hover:text-[var(--text-bright)] transition-colors mb-3">
 <ArrowLeft size={14} />
 Library
 </Link>
 <div className="flex items-center gap-2 mb-2 flex-wrap">
 <AreaBadge area={report.area} />
 <span className="text-xs text-[var(--text-muted)]">{formatRelativeDate(report.createdAt)}</span>
 {history.length > 0 && (
 <span className="text-xs text-[var(--text-muted)]">· {history.length} prior {history.length !== 1 ? modeConfig.documentLabelPlural.toLowerCase() : modeConfig.documentLabel.toLowerCase()}</span>
 )}
 </div>
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">{report.title}</h1>
 <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-subtle)] flex-wrap">
 <span className="flex items-center gap-1">
 <FileText size={11} />
 {report.fileName} · {formatFileSize(report.fileSize)}
 </span>
 {report.directReport && (
 <span className="flex items-center gap-1">
 <User size={11} />
 {report.directReport.name} · {report.directReport.title}
 </span>
 )}
 {report.reportDate && (
 <span className="flex items-center gap-1">
 <Calendar size={11} />
 {formatDate(report.reportDate)}
 </span>
 )}
 </div>
 </div>

 <div className="flex items-center gap-2 shrink-0">
 <ReanalyzeButton reportId={report.id} />
 <ExportAnalysisPDFButton
 title={report.title}
 area={report.area}
 directName={report.directReport?.name}
 reportDate={report.reportDate ? formatDate(report.reportDate) : undefined}
 summary={report.summary ?? undefined}
 metrics={metrics}
 insights={insights}
 questions={questions}
 />
 <CopyNarrativeButton
 title={report.title}
 area={report.area}
 directName={report.directReport?.name}
 reportDate={report.reportDate ? formatDate(report.reportDate) : undefined}
 summary={report.summary ?? undefined}
 metrics={metrics}
 insights={insights}
 questions={questions}
 />
 <DispatchReportButton
 reportId={report.id}
 reportTitle={report.title}
 reportContext={[
 `Report: "${report.title}" (${report.area})`,
 report.summary ? `Summary: ${report.summary}` : '',
 metrics.length ? `Key metrics: ${metrics.slice(0, 6).map(m => `${m.label} ${m.value}`).join(', ')}` : '',
 insights.length ? `Insights: ${insights.map(i => `[${i.type}] ${i.text}`).join(' | ')}` : '',
 ].filter(Boolean).join('\n')}
 />
 <DeleteReportButton id={report.id} />
 </div>
 </div>

 {/* Navigation row: prev / next */}
 {(prevReport || nextReport) && (
 <div className="flex items-center justify-between gap-4 pt-1 border-t border-[var(--border)]">
 <div className="flex-1 min-w-0">
 {prevReport ? (
 <Link
 href={`/reports/${prevReport.id}`}
 className="group inline-flex items-center gap-1.5 text-xs text-[var(--text-subtle)] hover:text-[var(--text-bright)] transition-colors max-w-xs"
 >
 <ChevronLeft size={13} className="shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text-body)]" />
 <span className="truncate">{prevReport.title}</span>
 {prevReport.area !== report.area && (
 <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-muted)]">{prevReport.area}</span>
 )}
 </Link>
 ) : <span />}
 </div>
 <div className="flex-1 min-w-0 flex justify-end">
 {nextReport ? (
 <Link
 href={`/reports/${nextReport.id}`}
 className="group inline-flex items-center gap-1.5 text-xs text-[var(--text-subtle)] hover:text-[var(--text-bright)] transition-colors max-w-xs"
 >
 {nextReport.area !== report.area && (
 <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-muted)]">{nextReport.area}</span>
 )}
 <span className="truncate">{nextReport.title}</span>
 <ChevronRight size={13} className="shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text-body)]" />
 </Link>
 ) : <span />}
 </div>
 </div>
 )}
 </>
 )

 // ── Document pane (left) ──────────────────────────────────────────────────
 const docSlot = (
 <RawContent
 content={report.rawContent}
 displayContent={report.displayContent ?? undefined}
 fileType={report.fileType}
 reportId={report.id}
 hasFile={!!report.filePath}
 />
 )

 // ── Analysis pane (right) ─────────────────────────────────────────────────
 const analysisSlot = (
 <>
 {/* Summary */}
 {report.summary && (
 <section className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5">
 <h2 className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] mb-3">Summary</h2>
 <p className="text-sm text-[var(--text-body)] leading-relaxed">{report.summary}</p>
 </section>
 )}

 {/* Analyst notes */}
 <ReportNotesEditor
 reportId={report.id}
 reportTitle={report.title}
 initialNotes={report.userNotes ?? null}
 storyName={report.storyName ?? null}
 currentProjectId={currentProjectId}
 currentProjectName={currentProjectName}
 />

 {/* What changed */}
 {showReportMetrics && comparison && (
 <section>
 <h2 className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] mb-3 flex items-center gap-1.5">
 <GitCompare size={11} />
 {labels.comparison}
 </h2>
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
 {comparison.headline && (
 <div className="px-4 py-3 bg-[var(--surface-2)] border-b border-[var(--border)]">
 <p className="text-sm font-medium text-[var(--text-bright)]">{comparison.headline}</p>
 </div>
 )}
 {comparison.changes.length > 0 && (
 <div className="divide-y divide-[var(--border)]">
 {comparison.changes.map((change, i) => (
 <div key={i} className="flex items-start gap-3 px-4 py-3">
 <span className={`shrink-0 text-sm font-bold w-4 text-center ${directionColor[change.direction] ?? 'text-[var(--text-muted)]'}`}>
 {directionIcon[change.direction] ?? '·'}
 </span>
 <div className="flex-1 min-w-0">
 <div className="flex items-baseline gap-2 flex-wrap">
 <span className="text-sm font-medium text-[var(--text-bright)]">{change.metric}</span>
 {change.significance === 'high' && (
 <span className="text-xs bg-[var(--red-dim)] text-[var(--red)] px-1.5 py-0.5 rounded font-medium">significant</span>
 )}
 </div>
 <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-subtle)]">
 <span className="line-through text-[var(--text-muted)]">{change.previous}</span>
 <span>→</span>
 <span className={`font-medium ${
 change.direction === 'improved' ? 'text-green-700' :
 change.direction === 'declined' ? 'text-red-700' : 'text-[var(--text-body)]'
 }`}>{change.current}</span>
 </div>
 {change.note && <p className="text-xs text-[var(--text-muted)] mt-0.5">{change.note}</p>}
 </div>
 </div>
 ))}
 </div>
 )}
 {(comparison.newTopics.length > 0 || comparison.removedTopics.length > 0) && (
 <div className="px-4 py-3 border-t border-[var(--border)] flex gap-6 flex-wrap">
 {comparison.newTopics.length > 0 && (
 <div>
 <p className="text-xs font-medium text-[var(--text-subtle)] mb-1">New this report</p>
 <div className="flex flex-wrap gap-1">
 {comparison.newTopics.map((t, i) => (
 <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-[4px]">{t}</span>
 ))}
 </div>
 </div>
 )}
 {comparison.removedTopics.length > 0 && (
 <div>
 <p className="text-xs font-medium text-[var(--text-subtle)] mb-1">Not mentioned this time</p>
 <div className="flex flex-wrap gap-1">
 {comparison.removedTopics.map((t, i) => (
 <span key={i} className="text-xs bg-[var(--surface-2)] text-[var(--text-subtle)] px-2 py-0.5 rounded-[4px]">{t}</span>
 ))}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 </section>
 )}

 {/* Metrics */}
 {showReportMetrics && metrics.length > 0 && (
 <section>
 <h2 className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] mb-3 flex items-center gap-1.5">
 <TrendingUp size={11} />
 {labels.metrics}
 {periodLabel && (
 <span className="ml-1 text-[var(--text-muted)] font-normal normal-case tracking-normal">
 · vs prior {modeConfig.documentLabel.toLowerCase()} ({periodLabel})
 </span>
 )}
 </h2>
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] divide-y divide-[var(--border)]">
 {metrics.map((m, i) => {
 const change = m.label ? changesByMetric.get(m.label.toLowerCase()) : undefined
 const pp = change ? ppDelta(change.previous, change.current) : null
 return (
 <div key={i} className="flex items-start justify-between px-4 py-3 gap-4">
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-[var(--text-bright)]">{m.label}</p>
 {m.context && <p className="text-xs text-[var(--text-muted)] mt-0.5">{m.context}</p>}
 </div>
 <div className="flex items-start gap-2 max-w-[60%] min-w-0 text-right overflow-hidden">
 {change && (
 <div className="flex items-center gap-1.5 text-xs shrink-0 mt-0.5">
 <span className="text-[var(--text-muted)] line-through">{change.previous}</span>
 <span className={cn('font-medium', directionColor[change.direction] ?? 'text-[var(--text-muted)]')}>
 {directionIcon[change.direction] ?? '·'}
 {pp && <span className="ml-0.5 font-normal">{pp}</span>}
 </span>
 </div>
 )}
 {m.status && m.status !== 'neutral' && <span className="shrink-0 mt-0.5"><StatusBadge status={m.status} /></span>}
 <span className="text-sm font-semibold text-[var(--text-bright)] break-words min-w-0">{m.value}</span>
 </div>
 </div>
 )
 })}
 </div>
 </section>
 )}

 {/* Insights */}
 {insights.length > 0 && (
 <section>
 <h2 className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] mb-3 flex items-center gap-1.5">
 <AlertTriangle size={11} />
 {labels.flags}
 </h2>
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] divide-y divide-[var(--border)]">
 {insights.map((insight, i) => (
 <div key={i} className="flex items-start gap-3 px-4 py-3">
 <div className="w-24 shrink-0">
 <InsightTypeBadge type={insight.type} />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm text-[var(--text-body)]">{insight.text}</p>
 {insight.area && <p className="text-xs text-[var(--text-muted)] mt-0.5">{insight.area}</p>}
 </div>
 </div>
 ))}
 </div>
 </section>
 )}

 {/* Questions */}
 {questions.length > 0 && (
 <section>
 <h2 className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] mb-3 flex items-center gap-1.5">
 <HelpCircle size={11} />
 {labels.questionsHeading}{report.directReport ? ` — ${report.directReport.name}` : ''}
 </h2>
 <div className="space-y-3">
 {[...highQuestions, ...otherQuestions].map((q, i) => (
 <div key={i} className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] px-4 py-4">
 <div className="flex items-start justify-between gap-3">
 <p className="text-sm font-medium text-[var(--text-bright)]">{q.text}</p>
 <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
 q.priority === 'high' ? 'bg-[var(--red-dim)] text-[var(--red)]' :
 q.priority === 'medium' ? 'bg-[var(--amber-dim)] text-[var(--amber)]' :
 'bg-[var(--surface-2)] text-[var(--text-subtle)]'
 }`}>
 {q.priority}
 </span>
 </div>
 <p className="text-xs text-[var(--text-subtle)] mt-2 leading-relaxed">{q.why}</p>
 </div>
 ))}
 </div>
 </section>
 )}

 {showEntities && entities.length > 0 && (
 <EntitiesSection
 entities={entities.map(e => ({
 id: e.id,
 type: e.type,
 name: e.name,
 context: e.context,
 }))}
 crossLinks={crossLinks}
 area={report.area}
 timelineHref={timelineHref}
 />
 )}

 {showTimeline && timelineEvents.length > 0 && (
 <TimelineSection
 events={timelineEvents.map(e => ({
 id: e.id,
 dateText: e.dateText,
 dateSortKey: e.dateSortKey,
 event: e.event,
 }))}
 />
 )}

 {showRedactions && redactions.length > 0 && (
 <RedactionsSection redactions={redactions} />
 )}

 {showVerification && verificationChecklist.length > 0 && (
 <VerificationSection checklist={verificationChecklist} />
 )}

 {showDocComparison && journalismComparison && (
 <JournalismComparisonSection
 comparison={journalismComparison}
 prevTitle={prevReportTitle}
 />
 )}

 {/* History for this area */}
 {history.length > 0 && (
 <section>
 <h2 className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] mb-3 flex items-center gap-1.5">
 <Clock size={11} />
 Previous {report.area} {modeConfig.documentLabelPlural.toLowerCase()}
 </h2>
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] divide-y divide-[var(--border)]">
 {history.map(prev => {
 const prevComparison = parseJsonSafe<Comparison | null>(prev.comparison, null)
 return (
 <Link
 key={prev.id}
 href={`/reports/${prev.id}`}
 className="flex items-start gap-4 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors"
 >
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-[var(--text-bright)]">{prev.title}</p>
 {prevComparison?.headline && (
 <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">{prevComparison.headline}</p>
 )}
 {!prevComparison && prev.summary && (
 <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">{prev.summary}</p>
 )}
 </div>
 <span className="shrink-0 text-xs text-[var(--text-muted)]">{formatRelativeDate(prev.createdAt)}</span>
 </Link>
 )
 })}
 </div>
 </section>
 )}
 </>
 )

 return (
 <ReportContent
 header={header}
 docSlot={docSlot}
 analysisSlot={analysisSlot}
 currentProjectId={currentProjectId}
 currentProjectName={currentProjectName}
 />
 )
}

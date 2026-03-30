import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { formatDate, formatRelativeDate, formatFileSize, cn, parseJsonSafe } from '@/lib/utils'
import type { Metric, Insight, Question } from '@/lib/utils'
import { getModeConfig } from '@/lib/mode'
import { getReportLabels } from '@/lib/mode-labels'
import { AreaBadge, InsightTypeBadge, StatusBadge } from '@/components/Badge'
import { ArrowLeft, FileText, Calendar, User, HelpCircle, TrendingUp, AlertTriangle, GitCompare, Clock } from 'lucide-react'
import DeleteReportButton from './DeleteButton'
import DispatchReportButton from './DispatchReportButton'
import ReportContent from './ReportContent'
import RawContent from './RawContent'
import CopyNarrativeButton from './CopyNarrativeButton'
import ExportAnalysisPDFButton from './ExportAnalysisPDFButton'
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
  const history = await prisma.report.findMany({
    where: { area: report.area, id: { not: id } },
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: { id: true, title: true, createdAt: true, summary: true, comparison: true },
  })

  // Mode config
  const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  const modeConfig = getModeConfig(modeRow?.value)
  const { entities: showEntities, timeline: showTimeline, redactions: showRedactions, verification: showVerification, documentComparison: showDocComparison } = modeConfig.features
  const labels = getReportLabels(modeConfig.id)

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

  // Cross-document entity linking: find other reports mentioning the same entity names
  type CrossDocResult = { name: string; type: string; reportIds: string[]; reportTitles: Record<string, string> }
  const crossLinks: CrossDocResult[] = []
  if (showEntities && entities.length > 0) {
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
  }

  // Parse journalism data
  const redactions = journalismRow ? parseJsonSafe<RedactionItem[]>(journalismRow.redactions, []) : []
  const journalismComparison = journalismRow ? parseJsonSafe<JournalismComparisonData | null>(journalismRow.journalismComparison, null) : null
  const verificationChecklist = journalismRow ? parseJsonSafe<VerificationItem[]>(journalismRow.verificationChecklist, []) : []

  // Title of the previous report (for journalism comparison label)
  const prevReportTitle = history[0]?.title

  const metrics    = parseJsonSafe<Metric[]>(report.metrics, [])
  const insights   = parseJsonSafe<Insight[]>(report.insights, [])
  const questions  = parseJsonSafe<Question[]>(report.questions, [])
  const comparison = parseJsonSafe<Comparison | null>(report.comparison, null)

  const highQuestions = questions.filter(q => q.priority === 'high')
  const otherQuestions = questions.filter(q => q.priority !== 'high')

  const directionIcon: Record<string, string> = {
    improved: '↑',
    declined: '↓',
    unchanged: '→',
    new: '+',
    removed: '–',
  }

  const directionColor: Record<string, string> = {
    improved: 'text-green-600',
    declined: 'text-red-600',
    unchanged: 'text-gray-400 dark:text-zinc-500',
    new: 'text-blue-600',
    removed: 'text-gray-400 dark:text-zinc-500',
  }

  // Period-over-period helpers
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

  // Build lookup: metric label → comparison change
  const changesByMetric = new Map(
    (comparison?.changes ?? []).map(c => [c.metric.toLowerCase(), c])
  )

  // Calculate percentage point delta for % values
  function ppDelta(prev?: string, curr?: string): string | null {
    if (!prev || !curr) return null
    if (!prev.includes('%') || !curr.includes('%')) return null
    const p = parseFloat(prev.replace(/[^0-9.-]/g, ''))
    const c = parseFloat(curr.replace(/[^0-9.-]/g, ''))
    if (isNaN(p) || isNaN(c)) return null
    const d = Math.round((c - p) * 10) / 10
    return (d > 0 ? '+' : '') + d + 'pp'
  }

  return (
    <ReportContent>
      {/* Back */}
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
        <ArrowLeft size={14} />
        Overview
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <AreaBadge area={report.area} />
            <span className="text-xs text-gray-400 dark:text-zinc-500">{formatRelativeDate(report.createdAt)}</span>
            {history.length > 0 && (
              <span className="text-xs text-gray-400 dark:text-zinc-500">· {history.length} prior {history.length !== 1 ? modeConfig.documentLabelPlural.toLowerCase() : modeConfig.documentLabel.toLowerCase()}</span>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">{report.title}</h1>

          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-zinc-500 flex-wrap">
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

      {/* Summary */}
      {report.summary && (
        <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Summary</h2>
          <p className="text-sm text-gray-700 dark:text-zinc-200 leading-relaxed">{report.summary}</p>
        </section>
      )}

      {/* What changed — comparison with previous */}
      {comparison && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <GitCompare size={11} />
            {labels.comparison}
          </h2>
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden">
            {comparison.headline && (
              <div className="px-4 py-3 bg-gray-50 dark:bg-zinc-800 border-b border-gray-100 dark:border-zinc-700">
                <p className="text-sm font-medium text-gray-800 dark:text-zinc-100">{comparison.headline}</p>
              </div>
            )}

            {comparison.changes.length > 0 && (
              <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                {comparison.changes.map((change, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <span className={`shrink-0 text-sm font-bold w-4 text-center ${directionColor[change.direction] ?? 'text-gray-400 dark:text-zinc-500'}`}>
                      {directionIcon[change.direction] ?? '·'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-zinc-50">{change.metric}</span>
                        {change.significance === 'high' && (
                          <span className="text-xs bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 px-1.5 py-0.5 rounded font-medium">significant</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-zinc-400">
                        <span className="line-through text-gray-400 dark:text-zinc-500">{change.previous}</span>
                        <span>→</span>
                        <span className={`font-medium ${
                          change.direction === 'improved' ? 'text-green-700' :
                          change.direction === 'declined' ? 'text-red-700' : 'text-gray-700 dark:text-zinc-200'
                        }`}>{change.current}</span>
                      </div>
                      {change.note && <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{change.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(comparison.newTopics.length > 0 || comparison.removedTopics.length > 0) && (
              <div className="px-4 py-3 border-t border-gray-100 dark:border-zinc-800 flex gap-6 flex-wrap">
                {comparison.newTopics.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">New this report</p>
                    <div className="flex flex-wrap gap-1">
                      {comparison.newTopics.map((t, i) => (
                        <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {comparison.removedTopics.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Not mentioned this time</p>
                    <div className="flex flex-wrap gap-1">
                      {comparison.removedTopics.map((t, i) => (
                        <span key={i} className="text-xs bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 px-2 py-0.5 rounded-full">{t}</span>
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
      {metrics.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <TrendingUp size={11} />
            {labels.metrics}
            {periodLabel && (
              <span className="ml-1 text-gray-300 dark:text-zinc-600 font-normal normal-case tracking-normal">
                · vs prior {modeConfig.documentLabel.toLowerCase()} ({periodLabel})
              </span>
            )}
          </h2>
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl divide-y divide-gray-100 dark:divide-zinc-800">
            {metrics.map((m, i) => {
              const change = changesByMetric.get(m.label.toLowerCase())
              const pp = change ? ppDelta(change.previous, change.current) : null
              return (
                <div key={i} className="flex items-start justify-between px-4 py-3 gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-50">{m.label}</p>
                    {m.context && <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{m.context}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {change && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-gray-400 dark:text-zinc-500 line-through">{change.previous}</span>
                        <span className={cn('font-medium', directionColor[change.direction] ?? 'text-gray-400 dark:text-zinc-500')}>
                          {directionIcon[change.direction] ?? '·'}
                          {pp && <span className="ml-0.5 font-normal">{pp}</span>}
                        </span>
                      </div>
                    )}
                    {m.status && m.status !== 'neutral' && <StatusBadge status={m.status} />}
                    <span className="text-sm font-semibold text-gray-900 dark:text-zinc-50">{m.value}</span>
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
          <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <AlertTriangle size={11} />
            {labels.flags}
          </h2>
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl divide-y divide-gray-100 dark:divide-zinc-800">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <InsightTypeBadge type={insight.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-zinc-200">{insight.text}</p>
                  {insight.area && <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{insight.area}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Questions */}
      {questions.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <HelpCircle size={11} />
            {labels.questionsHeading}{report.directReport ? ` — ${report.directReport.name}` : ''}
          </h2>
          <div className="space-y-3">
            {[...highQuestions, ...otherQuestions].map((q, i) => (
              <div key={i} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-50">{q.text}</p>
                  <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                    q.priority === 'high' ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300' :
                    q.priority === 'medium' ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-300' :
                    'bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'
                  }`}>
                    {q.priority}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 leading-relaxed">{q.why}</p>
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
          <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Clock size={11} />
            Previous {report.area} {modeConfig.documentLabelPlural.toLowerCase()}
          </h2>
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl divide-y divide-gray-100 dark:divide-zinc-800">
            {history.map(prev => {
              let prevComparison: Comparison | null = null
              prevComparison = parseJsonSafe<Comparison | null>(prev.comparison, null)
              return (
                <Link
                  key={prev.id}
                  href={`/reports/${prev.id}`}
                  className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-50">{prev.title}</p>
                    {prevComparison?.headline && (
                      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 line-clamp-1">{prevComparison.headline}</p>
                    )}
                    {!prevComparison && prev.summary && (
                      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 line-clamp-1">{prev.summary}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-gray-400 dark:text-zinc-500">{formatRelativeDate(prev.createdAt)}</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Raw content */}
      <section>
        <details className="group" open={['xlsx', 'xls', 'csv', 'docx', 'doc', 'pdf'].includes(report.fileType) || undefined}>
          <summary className="cursor-pointer text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 list-none hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
            <FileText size={11} />
            {labels.content}
            <span className="ml-1 text-gray-300 dark:text-zinc-600 group-open:hidden">▸</span>
            <span className="ml-1 text-gray-300 dark:text-zinc-600 hidden group-open:inline">▾</span>
          </summary>
          <div className="mt-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-4">
            <RawContent
              content={report.rawContent}
              displayContent={report.displayContent ?? undefined}
              fileType={report.fileType}
              reportId={report.id}
              hasFile={!!report.filePath}
            />
          </div>
        </details>
      </section>
    </ReportContent>
  )
}

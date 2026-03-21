import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { formatDate, formatRelativeDate, formatFileSize, cn } from '@/lib/utils'
import { AreaBadge, InsightTypeBadge, StatusBadge } from '@/components/Badge'
import { ArrowLeft, FileText, Calendar, User, HelpCircle, TrendingUp, AlertTriangle, GitCompare, Clock } from 'lucide-react'
import DeleteReportButton from './DeleteButton'
import RawContent from './RawContent'

interface Metric {
  label: string
  value: string
  context?: string
  trend?: 'up' | 'down' | 'flat' | 'unknown'
  status?: 'positive' | 'negative' | 'neutral' | 'warning'
}

interface Insight {
  type: 'observation' | 'anomaly' | 'risk' | 'opportunity'
  text: string
  area?: string
}

interface Question {
  text: string
  why: string
  priority: 'high' | 'medium' | 'low'
}

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

  let metrics: Metric[] = []
  let insights: Insight[] = []
  let questions: Question[] = []
  let comparison: Comparison | null = null

  try { metrics = JSON.parse(report.metrics ?? '[]') } catch {}
  try { insights = JSON.parse(report.insights ?? '[]') } catch {}
  try { questions = JSON.parse(report.questions ?? '[]') } catch {}
  try { comparison = report.comparison ? JSON.parse(report.comparison) : null } catch {}

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
    unchanged: 'text-gray-400',
    new: 'text-blue-600',
    removed: 'text-gray-400',
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
    <div className="space-y-8 max-w-3xl">
      {/* Back */}
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
        <ArrowLeft size={14} />
        Overview
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <AreaBadge area={report.area} />
            <span className="text-xs text-gray-400">{formatRelativeDate(report.createdAt)}</span>
            {history.length > 0 && (
              <span className="text-xs text-gray-400">· {history.length} prior report{history.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">{report.title}</h1>

          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
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

        <DeleteReportButton id={report.id} />
      </div>

      {/* Summary */}
      {report.summary && (
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Summary</h2>
          <p className="text-sm text-gray-700 leading-relaxed">{report.summary}</p>
        </section>
      )}

      {/* What changed — comparison with previous */}
      {comparison && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <GitCompare size={11} />
            What changed from last report
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {comparison.headline && (
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-800">{comparison.headline}</p>
              </div>
            )}

            {comparison.changes.length > 0 && (
              <div className="divide-y divide-gray-100">
                {comparison.changes.map((change, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <span className={`shrink-0 text-sm font-bold w-4 text-center ${directionColor[change.direction] ?? 'text-gray-400'}`}>
                      {directionIcon[change.direction] ?? '·'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{change.metric}</span>
                        {change.significance === 'high' && (
                          <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">significant</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                        <span className="line-through text-gray-400">{change.previous}</span>
                        <span>→</span>
                        <span className={`font-medium ${
                          change.direction === 'improved' ? 'text-green-700' :
                          change.direction === 'declined' ? 'text-red-700' : 'text-gray-700'
                        }`}>{change.current}</span>
                      </div>
                      {change.note && <p className="text-xs text-gray-400 mt-0.5">{change.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(comparison.newTopics.length > 0 || comparison.removedTopics.length > 0) && (
              <div className="px-4 py-3 border-t border-gray-100 flex gap-6 flex-wrap">
                {comparison.newTopics.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">New this report</p>
                    <div className="flex flex-wrap gap-1">
                      {comparison.newTopics.map((t, i) => (
                        <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {comparison.removedTopics.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Not mentioned this time</p>
                    <div className="flex flex-wrap gap-1">
                      {comparison.removedTopics.map((t, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t}</span>
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
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <TrendingUp size={11} />
            Key Metrics
            {periodLabel && (
              <span className="ml-1 text-gray-300 font-normal normal-case tracking-normal">
                · vs prior report ({periodLabel})
              </span>
            )}
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {metrics.map((m, i) => {
              const change = changesByMetric.get(m.label.toLowerCase())
              const pp = change ? ppDelta(change.previous, change.current) : null
              return (
                <div key={i} className="flex items-start justify-between px-4 py-3 gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{m.label}</p>
                    {m.context && <p className="text-xs text-gray-400 mt-0.5">{m.context}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {change && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-gray-400 line-through">{change.previous}</span>
                        <span className={cn('font-medium', directionColor[change.direction] ?? 'text-gray-400')}>
                          {directionIcon[change.direction] ?? '·'}
                          {pp && <span className="ml-0.5 font-normal">{pp}</span>}
                        </span>
                      </div>
                    )}
                    {m.status && m.status !== 'neutral' && <StatusBadge status={m.status} />}
                    <span className="text-sm font-semibold text-gray-900">{m.value}</span>
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
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <AlertTriangle size={11} />
            Observations & Flags
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <InsightTypeBadge type={insight.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{insight.text}</p>
                  {insight.area && <p className="text-xs text-gray-400 mt-0.5">{insight.area}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Questions */}
      {questions.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <HelpCircle size={11} />
            Questions to ask{report.directReport ? ` ${report.directReport.name}` : ''}
          </h2>
          <div className="space-y-3">
            {[...highQuestions, ...otherQuestions].map((q, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900">{q.text}</p>
                  <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                    q.priority === 'high' ? 'bg-red-50 text-red-600' :
                    q.priority === 'medium' ? 'bg-amber-50 text-amber-600' :
                    'bg-gray-50 text-gray-500'
                  }`}>
                    {q.priority}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">{q.why}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* History for this area */}
      {history.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Clock size={11} />
            Previous {report.area} reports
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {history.map(prev => {
              let prevComparison: Comparison | null = null
              try { prevComparison = prev.comparison ? JSON.parse(prev.comparison) : null } catch {}
              return (
                <Link
                  key={prev.id}
                  href={`/reports/${prev.id}`}
                  className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{prev.title}</p>
                    {prevComparison?.headline && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{prevComparison.headline}</p>
                    )}
                    {!prevComparison && prev.summary && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{prev.summary}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">{formatRelativeDate(prev.createdAt)}</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Raw content */}
      <section>
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 list-none hover:text-gray-600 transition-colors">
            <FileText size={11} />
            Report Content
            <span className="ml-1 text-gray-300 group-open:hidden">▸</span>
            <span className="ml-1 text-gray-300 hidden group-open:inline">▾</span>
          </summary>
          <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4">
            <RawContent content={report.rawContent} displayContent={report.displayContent ?? undefined} fileType={report.fileType} />
          </div>
        </details>
      </section>
    </div>
  )
}

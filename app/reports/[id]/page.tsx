import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { formatDate, formatRelativeDate, formatFileSize } from '@/lib/utils'
import { AreaBadge, InsightTypeBadge, StatusBadge } from '@/components/Badge'
import { ArrowLeft, FileText, Calendar, User, Trash2, HelpCircle, TrendingUp, AlertTriangle } from 'lucide-react'
import DeleteReportButton from './DeleteButton'

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

export const dynamic = 'force-dynamic'

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const report = await prisma.report.findUnique({
    where: { id },
    include: { directReport: true },
  })

  if (!report) notFound()

  let metrics: Metric[] = []
  let insights: Insight[] = []
  let questions: Question[] = []

  try { metrics = JSON.parse(report.metrics ?? '[]') } catch {}
  try { insights = JSON.parse(report.insights ?? '[]') } catch {}
  try { questions = JSON.parse(report.questions ?? '[]') } catch {}

  const highQuestions = questions.filter(q => q.priority === 'high')
  const otherQuestions = questions.filter(q => q.priority !== 'high')

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

      {/* Metrics */}
      {metrics.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <TrendingUp size={11} />
            Key Metrics
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {metrics.map((m, i) => (
              <div key={i} className="flex items-start justify-between px-4 py-3 gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{m.label}</p>
                  {m.context && <p className="text-xs text-gray-400 mt-0.5">{m.context}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {m.status && m.status !== 'neutral' && <StatusBadge status={m.status} />}
                  <span className="text-sm font-semibold text-gray-900">{m.value}</span>
                </div>
              </div>
            ))}
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
                    q.priority === 'high'
                      ? 'bg-red-50 text-red-600'
                      : q.priority === 'medium'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-gray-50 text-gray-500'
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

      {/* Raw content (collapsible) */}
      <section>
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 list-none hover:text-gray-600 transition-colors">
            <FileText size={11} />
            Raw Report Content
            <span className="ml-1 text-gray-300 group-open:hidden">▸</span>
            <span className="ml-1 text-gray-300 hidden group-open:inline">▾</span>
          </summary>
          <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4">
            <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed font-mono max-h-96 overflow-y-auto">
              {report.rawContent}
            </pre>
          </div>
        </details>
      </section>
    </div>
  )
}

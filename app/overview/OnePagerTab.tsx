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
              className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            >
              <ArrowLeft size={11} /> Overview
            </Link>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">One Pager</h1>
          <p className="text-gray-500 dark:text-zinc-400 text-sm mt-0.5">{reports.length} {reports.length !== 1 ? modeConfig.documentLabelPlural.toLowerCase() : modeConfig.documentLabel.toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Week navigation */}
          <div className="flex items-center gap-1 border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden text-sm">
            {prevHref ? (
              <Link href={prevHref} className="px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-50">
                <ChevronLeft size={14} />
              </Link>
            ) : (
              <span className="px-2 py-1.5 text-gray-200 dark:text-zinc-700 cursor-not-allowed"><ChevronLeft size={14} /></span>
            )}
            <span className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-zinc-200 border-x border-gray-200 dark:border-zinc-700">{weekLabel}</span>
            {nextHref ? (
              <Link href={nextHref} className="px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-50">
                <ChevronRight size={14} />
              </Link>
            ) : (
              <span className="px-2 py-1.5 text-gray-200 dark:text-zinc-700 cursor-not-allowed"><ChevronRight size={14} /></span>
            )}
          </div>
          <OnePagerClient reportCount={reports.length} reports={reports} weekLabel={weekLabel} />
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-zinc-500 text-sm">No {modeConfig.documentLabelPlural.toLowerCase()} for this period.</div>
      ) : (
        <div className="space-y-6 print:space-y-8">
          {reports.map((r, i) => (
            <div
              key={r.id}
              className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl p-6 print:border-gray-300 print:rounded-none print:break-inside-avoid"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <AreaBadge area={r.area} />
                  {r.directName && (
                    <span className="text-xs text-gray-500 dark:text-zinc-400">{r.directName}{r.directTitle ? ` · ${r.directTitle}` : ''}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-zinc-500 shrink-0">
                  <span>#{i + 1}</span>
                  <span>{formatRelativeDate(new Date(r.createdAt))}</span>
                </div>
              </div>

              <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-50 mb-2">{r.title}</h2>

              {r.summary && (
                <p className="text-sm text-gray-600 dark:text-zinc-300 leading-relaxed mb-4">{r.summary}</p>
              )}

              {r.metrics.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">{labels.onePagerMetrics}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {r.metrics.map((m, mi) => (
                      <div key={mi} className={`rounded-lg px-3 py-2 ${
                        m.status === 'positive' ? 'bg-green-50 dark:bg-green-950' :
                        m.status === 'negative' ? 'bg-red-50 dark:bg-red-950' :
                        m.status === 'warning'  ? 'bg-amber-50 dark:bg-amber-950' : 'bg-gray-50 dark:bg-zinc-800'
                      }`}>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{m.label}</p>
                        <p className={`text-sm font-semibold mt-0.5 ${
                          m.status === 'positive' ? 'text-green-700 dark:text-green-300' :
                          m.status === 'negative' ? 'text-red-700 dark:text-red-300' :
                          m.status === 'warning'  ? 'text-amber-700 dark:text-amber-300' : 'text-gray-900 dark:text-zinc-50'
                        }`}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {r.insights.filter(ins => ins.type === 'risk' || ins.type === 'anomaly').length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">{labels.onePagerFlags}</p>
                  <div className="space-y-1">
                    {r.insights.filter(ins => ins.type === 'risk' || ins.type === 'anomaly').map((ins, ii) => (
                      <div key={ii} className="flex items-start gap-2 text-sm">
                        <span className={`font-bold text-xs mt-0.5 shrink-0 ${ins.type === 'risk' ? 'text-red-500' : 'text-amber-500'}`}>
                          {ins.type === 'risk' ? '⚠' : '!'}
                        </span>
                        <span className="text-gray-700 dark:text-zinc-200">{ins.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {r.questions.filter(q => q.priority === 'high').length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">{labels.onePagerQuestions}</p>
                  <div className="space-y-1">
                    {r.questions.filter(q => q.priority === 'high').map((q, qi) => (
                      <p key={qi} className="text-sm text-gray-700 dark:text-zinc-200">? {q.text}</p>
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

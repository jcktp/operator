import { prisma } from '@/lib/db'
import { AreaBadge } from '@/components/Badge'
import { formatRelativeDate } from '@/lib/utils'
import { FileText } from 'lucide-react'
import OnePagerClient from './OnePagerClient'

export const dynamic = 'force-dynamic'

interface Metric { label: string; value: string; status?: string }
interface Insight { type: string; text: string }
interface Question { text: string; why: string; priority: string }

function safe<T>(s: string | null | undefined, fb: T): T {
  if (!s) return fb
  try { return JSON.parse(s) as T } catch { return fb }
}

export default async function OnePagerPage() {
  const reports = await prisma.report.findMany({
    orderBy: [{ area: 'asc' }, { createdAt: 'desc' }],
    include: { directReport: true },
  })

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <FileText size={32} className="text-gray-200 mb-4" />
        <p className="text-gray-500 text-sm">No reports yet.</p>
      </div>
    )
  }

  const serialized = reports.map(r => ({
    id: r.id,
    title: r.title,
    area: r.area,
    summary: r.summary,
    metrics: safe<Metric[]>(r.metrics, []),
    insights: safe<Insight[]>(r.insights, []),
    questions: safe<Question[]>(r.questions, []),
    createdAt: r.createdAt.toISOString(),
    directName: r.directReport?.name,
    directTitle: r.directReport?.title,
  }))

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">One Pager</h1>
          <p className="text-gray-500 text-sm mt-0.5">All {reports.length} reports in one view</p>
        </div>
        <OnePagerClient reportCount={reports.length} />
      </div>

      <div className="space-y-6 print:space-y-8">
        {serialized.map((r, i) => (
          <div
            key={r.id}
            className="bg-white border border-gray-200 rounded-2xl p-6 print:border-gray-300 print:rounded-none print:break-inside-avoid"
          >
            {/* Report header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <AreaBadge area={r.area} />
                {r.directName && (
                  <span className="text-xs text-gray-500">{r.directName}{r.directTitle ? ` · ${r.directTitle}` : ''}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
                <span>#{i + 1}</span>
                <span>{formatRelativeDate(new Date(r.createdAt))}</span>
              </div>
            </div>

            <h2 className="text-base font-semibold text-gray-900 mb-2">{r.title}</h2>

            {r.summary && (
              <p className="text-sm text-gray-600 leading-relaxed mb-4">{r.summary}</p>
            )}

            {/* Metrics */}
            {r.metrics.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Metrics</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {r.metrics.map((m, mi) => (
                    <div key={mi} className={`rounded-lg px-3 py-2 ${
                      m.status === 'positive' ? 'bg-green-50' :
                      m.status === 'negative' ? 'bg-red-50' :
                      m.status === 'warning'  ? 'bg-amber-50' : 'bg-gray-50'
                    }`}>
                      <p className="text-xs text-gray-400 truncate">{m.label}</p>
                      <p className={`text-sm font-semibold mt-0.5 ${
                        m.status === 'positive' ? 'text-green-700' :
                        m.status === 'negative' ? 'text-red-700' :
                        m.status === 'warning'  ? 'text-amber-700' : 'text-gray-900'
                      }`}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Flags */}
            {r.insights.filter(i => i.type === 'risk' || i.type === 'anomaly').length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Flags</p>
                <div className="space-y-1">
                  {r.insights.filter(i => i.type === 'risk' || i.type === 'anomaly').map((ins, ii) => (
                    <div key={ii} className="flex items-start gap-2 text-sm">
                      <span className={`font-bold text-xs mt-0.5 shrink-0 ${ins.type === 'risk' ? 'text-red-500' : 'text-amber-500'}`}>
                        {ins.type === 'risk' ? '⚠' : '!'}
                      </span>
                      <span className="text-gray-700">{ins.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Questions */}
            {r.questions.filter(q => q.priority === 'high').length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Key questions</p>
                <div className="space-y-1">
                  {r.questions.filter(q => q.priority === 'high').map((q, qi) => (
                    <p key={qi} className="text-sm text-gray-700">? {q.text}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

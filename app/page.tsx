import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatRelativeDate } from '@/lib/utils'
import { AreaBadge, InsightTypeBadge, StatusBadge } from '@/components/Badge'
import { ArrowRight, FileText, Upload, AlertTriangle, HelpCircle } from 'lucide-react'

interface Metric {
  label: string
  value: string
  context?: string
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

export default async function DashboardPage() {
  const [reports, directs] = await Promise.all([
    prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { directReport: true },
    }),
    prisma.directReport.findMany({ orderBy: { name: 'asc' } }),
  ])

  const hasReports = reports.length > 0

  // Group reports by area — most recent per area
  const areaMap: Record<string, typeof reports[0]> = {}
  for (const r of reports) {
    if (!areaMap[r.area]) areaMap[r.area] = r
  }
  const activeAreas = Object.values(areaMap)

  // Collect flags and questions from recent reports
  const allInsights: (Insight & { reportTitle: string; reportId: string })[] = []
  const allQuestions: (Question & { reportTitle: string; directName?: string; reportId: string })[] = []

  for (const report of reports.slice(0, 10)) {
    if (report.insights) {
      try {
        const ins = JSON.parse(report.insights) as Insight[]
        for (const i of ins.filter(i => i.type === 'risk' || i.type === 'anomaly')) {
          allInsights.push({ ...i, reportTitle: report.title, reportId: report.id })
        }
      } catch {}
    }
    if (report.questions) {
      try {
        const qs = JSON.parse(report.questions) as Question[]
        for (const q of qs.filter(q => q.priority === 'high')) {
          allQuestions.push({
            ...q,
            reportTitle: report.title,
            directName: report.directReport?.name,
            reportId: report.id,
          })
        }
      } catch {}
    }
  }

  const topInsights = allInsights.slice(0, 5)
  const topQuestions = allQuestions.slice(0, 5)
  const coveredAreas = new Set(reports.map(r => r.area))

  if (!hasReports) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
          <FileText size={20} className="text-gray-400" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">No reports yet</h1>
        <p className="text-gray-500 text-sm max-w-sm mb-6">
          Upload your first report to get a unified view of your business.
        </p>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Upload size={15} />
          Add first report
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {reports.length} report{reports.length !== 1 ? 's' : ''} across {coveredAreas.size} area{coveredAreas.size !== 1 ? 's' : ''}
            {directs.length > 0 && ` · ${directs.length} direct${directs.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Upload size={14} />
          Add report
        </Link>
      </div>

      {/* Areas at a glance */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">By Area</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeAreas.map(report => {
            let metrics: Metric[] = []
            try {
              metrics = JSON.parse(report.metrics ?? '[]')
            } catch {}
            const topMetrics = metrics.slice(0, 3)

            return (
              <Link
                key={report.id}
                href={`/reports/${report.id}`}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <AreaBadge area={report.area} />
                  <span className="text-xs text-gray-400">{formatRelativeDate(report.createdAt)}</span>
                </div>

                <p className="text-sm text-gray-700 line-clamp-2 mb-3">
                  {report.summary ?? report.title}
                </p>

                {topMetrics.length > 0 && (
                  <div className="space-y-1.5 border-t border-gray-100 pt-3">
                    {topMetrics.map((m, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 truncate max-w-[60%]">{m.label}</span>
                        <div className="flex items-center gap-1">
                          {m.status && m.status !== 'neutral' && <StatusBadge status={m.status} />}
                          <span className="text-xs font-medium text-gray-900">{m.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-1 text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
                  <span>View report</span>
                  <ArrowRight size={11} />
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Flags + Questions grid */}
      {(topInsights.length > 0 || topQuestions.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {topInsights.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <AlertTriangle size={11} />
                Flags & Risks
              </h2>
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {topInsights.map((insight, i) => (
                  <Link
                    key={i}
                    href={`/reports/${insight.reportId}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <InsightTypeBadge type={insight.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700">{insight.text}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{insight.reportTitle}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {topQuestions.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <HelpCircle size={11} />
                Questions to ask
              </h2>
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {topQuestions.map((q, i) => (
                  <Link
                    key={i}
                    href={`/reports/${q.reportId}`}
                    className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm text-gray-800 font-medium">{q.text}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {q.directName ? `Ask ${q.directName}` : q.reportTitle}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Recent reports list */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Reports</h2>
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {reports.slice(0, 8).map(report => (
            <Link
              key={report.id}
              href={`/reports/${report.id}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-sm font-medium text-gray-900 truncate">{report.title}</span>
                  <AreaBadge area={report.area} />
                </div>
                {report.directReport && (
                  <p className="text-xs text-gray-400">{report.directReport.name} · {report.directReport.title}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-gray-400">{formatRelativeDate(report.createdAt)}</span>
                <ArrowRight size={14} className="text-gray-300" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

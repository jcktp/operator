import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatRelativeDate, formatDate, AREAS, AREA_COLORS } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'
import { FileText, ArrowRight, GitCompare, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Metric {
  label: string
  value: string
  status?: 'positive' | 'negative' | 'neutral' | 'warning'
}

interface Comparison {
  headline: string
}

export const dynamic = 'force-dynamic'

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>
}) {
  const { area: selectedArea } = await searchParams

  const [allReports, directs] = await Promise.all([
    prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      include: { directReport: true },
    }),
    prisma.directReport.findMany({ orderBy: { name: 'asc' } }),
  ])

  // Filter by area if selected
  const reports = selectedArea
    ? allReports.filter(r => r.area === selectedArea)
    : allReports

  // Stats per area
  const areaStats: Record<string, { count: number; latest: Date }> = {}
  for (const r of allReports) {
    if (!areaStats[r.area]) {
      areaStats[r.area] = { count: 0, latest: r.createdAt }
    }
    areaStats[r.area].count++
    if (r.createdAt > areaStats[r.area].latest) {
      areaStats[r.area].latest = r.createdAt
    }
  }

  const usedAreas = Object.keys(areaStats).sort()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Library</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          All reports, by area. Full history with diffs and questions.
        </p>
      </div>

      {allReports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
            <FileText size={20} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">No reports yet.</p>
          <Link href="/upload" className="mt-4 text-sm font-medium text-gray-900 underline">
            Upload your first report →
          </Link>
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          {/* Sidebar — area filter */}
          <aside className="w-44 shrink-0 space-y-1 sticky top-24">
            <Link
              href="/library"
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                !selectedArea
                  ? 'bg-gray-900 text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <span>All areas</span>
              <span className={cn('text-xs', !selectedArea ? 'text-gray-300' : 'text-gray-400')}>
                {allReports.length}
              </span>
            </Link>

            {usedAreas.map(area => {
              const color = AREA_COLORS[area] ?? 'bg-gray-50 text-gray-700 border-gray-200'
              const isActive = selectedArea === area
              return (
                <Link
                  key={area}
                  href={`/library?area=${encodeURIComponent(area)}`}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-gray-900 text-white font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <span className="truncate">{area}</span>
                  <span className={cn('text-xs shrink-0', isActive ? 'text-gray-300' : 'text-gray-400')}>
                    {areaStats[area].count}
                  </span>
                </Link>
              )
            })}
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-3">
            {selectedArea && (
              <div className="flex items-center gap-3 mb-1">
                <AreaBadge area={selectedArea} />
                <span className="text-sm text-gray-500">
                  {areaStats[selectedArea]?.count} report{areaStats[selectedArea]?.count !== 1 ? 's' : ''}
                  {' · '}last {formatRelativeDate(areaStats[selectedArea]?.latest)}
                </span>
              </div>
            )}

            {reports.map((report, i) => {
              let metrics: Metric[] = []
              let comparison: Comparison | null = null
              let questions: { text: string; priority: string }[] = []
              try { metrics = JSON.parse(report.metrics ?? '[]') } catch {}
              try { comparison = report.comparison ? JSON.parse(report.comparison) : null } catch {}
              try { questions = JSON.parse(report.questions ?? '[]') } catch {}

              const highQs = questions.filter(q => q.priority === 'high')

              // Show a divider when area changes (all-areas view)
              const prevArea = i > 0 ? reports[i - 1].area : null
              const showAreaDivider = !selectedArea && report.area !== prevArea

              return (
                <div key={report.id}>
                  {showAreaDivider && (
                    <div className="flex items-center gap-3 pt-2 pb-1">
                      <AreaBadge area={report.area} />
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>
                  )}

                  <Link
                    href={`/reports/${report.id}`}
                    className="block bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all group"
                  >
                    <div className="px-4 py-4">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {!selectedArea && <AreaBadge area={report.area} />}
                            <span className="text-sm font-semibold text-gray-900">{report.title}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {formatRelativeDate(report.createdAt)}
                            </span>
                            {report.reportDate && (
                              <span>Report date: {formatDate(report.reportDate)}</span>
                            )}
                            {report.directReport && (
                              <span>{report.directReport.name} · {report.directReport.title}</span>
                            )}
                            <span className="uppercase tracking-wide">{report.fileType}</span>
                          </div>
                        </div>
                        <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 mt-1" />
                      </div>

                      {/* Summary */}
                      {report.summary && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2 leading-relaxed">
                          {report.summary}
                        </p>
                      )}

                      {/* Key metrics strip */}
                      {metrics.length > 0 && (
                        <div className="flex items-center gap-4 mt-3 flex-wrap">
                          {metrics.slice(0, 4).map((m, mi) => (
                            <div key={mi} className="text-xs">
                              <span className="text-gray-400">{m.label}: </span>
                              <span className={cn(
                                'font-medium',
                                m.status === 'positive' ? 'text-green-700' :
                                m.status === 'negative' ? 'text-red-700' :
                                m.status === 'warning' ? 'text-amber-700' :
                                'text-gray-700'
                              )}>{m.value}</span>
                            </div>
                          ))}
                          {metrics.length > 4 && (
                            <span className="text-xs text-gray-400">+{metrics.length - 4} more</span>
                          )}
                        </div>
                      )}

                      {/* Diff headline + high-priority questions */}
                      {(comparison || highQs.length > 0) && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                          {comparison?.headline && (
                            <p className="text-xs text-gray-500 flex items-start gap-1.5">
                              <GitCompare size={11} className="shrink-0 mt-0.5 text-gray-400" />
                              {comparison.headline}
                            </p>
                          )}
                          {highQs.slice(0, 2).map((q, qi) => (
                            <p key={qi} className="text-xs text-gray-500 flex items-start gap-1.5">
                              <span className="shrink-0 text-red-400 font-bold">?</span>
                              {q.text}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

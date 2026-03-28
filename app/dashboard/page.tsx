import { prisma } from '@/lib/db'
import { getModeConfig } from '@/lib/mode'
import { cn, formatRelativeDate, parseJsonSafe } from '@/lib/utils'
import type { Metric, Insight, Question } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'
import Link from 'next/link'
import {
  AlertTriangle, HelpCircle, Activity, ArrowRight, Clock,
} from 'lucide-react'
import { StatCard, TrendIcon, HealthBar } from './DashboardCards'
import DashboardFilters from './DashboardFilters'
import DashboardCharts from './DashboardCharts'
import ExportButton from './ExportButton'
import type { AreaHealthDatum, TimelineDatum, InsightTypeDatum, MetricAreaDatum } from './DashboardCharts'
import type { ExportRow } from './ExportButton'

export const dynamic = 'force-dynamic'

// ── Types ───────────────────────────────────────────────────────────────────

interface ComparisonChange {
  metric: string; previous: string; current: string
  direction: 'improved' | 'declined' | 'unchanged' | 'new' | 'removed'
  significance: 'high' | 'medium' | 'low'
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function areaHealthScore(changes: ComparisonChange[]): number {
  if (!changes.length) return 50
  let score = 50
  for (const c of changes) {
    const w = c.significance === 'high' ? 10 : c.significance === 'medium' ? 5 : 2
    if (c.direction === 'improved') score += w
    else if (c.direction === 'declined') score -= w
  }
  return Math.max(0, Math.min(100, score))
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; from?: string; to?: string; direct?: string }>
}) {
  const { area: filterArea, from: filterFrom, to: filterTo, direct: filterDirect } = await searchParams

  const fromDate = filterFrom ? new Date(filterFrom) : null
  const toDate = filterTo ? new Date(filterTo + 'T23:59:59') : null

  const [allReports, directs, modeRow] = await Promise.all([
    prisma.report.findMany({
      where: {
        ...(filterArea ? { area: filterArea } : {}),
        ...(filterDirect ? { directReportId: filterDirect } : {}),
        ...(fromDate || toDate ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { directReport: true },
    }),
    prisma.directReport.findMany({ orderBy: { name: 'asc' } }),
    prisma.setting.findUnique({ where: { key: 'app_mode' } }),
  ])
  const modeConfig = getModeConfig(modeRow?.value)

  const allAreas = await prisma.report.findMany({
    select: { area: true }, distinct: ['area'], orderBy: { area: 'asc' },
  })

  // ── Aggregate by area ────────────────────────────────────────────────────

  const areaGroups: Record<string, typeof allReports> = {}
  for (const r of allReports) {
    if (!areaGroups[r.area]) areaGroups[r.area] = []
    areaGroups[r.area].push(r)
  }

  const areaCards = Object.entries(areaGroups).map(([area, reports]) => {
    const latest = reports[0]
    const metrics = parseJsonSafe<Metric[]>(latest.metrics, [])
    const changes = parseJsonSafe<{ changes: ComparisonChange[] }>(latest.comparison, { changes: [] }).changes
    const health = areaHealthScore(changes)
    return { area, reports, latest, metrics: metrics.slice(0, 4), changes, health, count: reports.length }
  }).sort((a, b) => b.health - a.health || a.area.localeCompare(b.area))

  // ── Flags & questions ────────────────────────────────────────────────────

  type FlagItem = { text: string; area: string; type: string; reportId: string }
  type QuestionItem = { text: string; area: string; directName?: string; reportId: string }

  const allFlags: FlagItem[] = []
  const allQuestions: QuestionItem[] = []

  for (const r of allReports.slice(0, 20)) {
    parseJsonSafe<Insight[]>(r.insights, [])
      .filter(i => i.type === 'risk' || i.type === 'anomaly')
      .slice(0, 3)
      .forEach(i => allFlags.push({ text: i.text, area: r.area, type: i.type, reportId: r.id }))

    parseJsonSafe<Question[]>(r.questions, [])
      .filter(q => q.priority === 'high')
      .slice(0, 2)
      .forEach(q => allQuestions.push({ text: q.text, area: r.area, directName: r.directReport?.name, reportId: r.id }))
  }

  // ── Summary stats ────────────────────────────────────────────────────────

  const totalReports = allReports.length
  const areasCount = Object.keys(areaGroups).length
  const flagCount = allFlags.length
  const pendingQuestions = allQuestions.length
  const avgHealth = areaCards.length
    ? Math.round(areaCards.reduce((s, a) => s + a.health, 0) / areaCards.length)
    : 50

  // ── Chart data ───────────────────────────────────────────────────────────

  const areaHealth: AreaHealthDatum[] = areaCards.map(a => ({ area: a.area, health: a.health }))

  // Reports over time — group by date bucket
  // Use monthly buckets if range > 90 days or no range set; daily otherwise
  const rangeMs = fromDate && toDate ? toDate.getTime() - fromDate.getTime() : null
  const useMonthly = !rangeMs || rangeMs > 90 * 86400000

  const buckets: Record<string, number> = {}
  for (const r of [...allReports].reverse()) {
    const d = new Date(r.createdAt)
    const key = useMonthly
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      : `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    buckets[key] = (buckets[key] || 0) + 1
  }
  const reportsOverTime: TimelineDatum[] = Object.entries(buckets).map(([date, count]) => ({ date, count }))

  // Insight type breakdown
  const insightCounts: Record<string, number> = {}
  for (const r of allReports) {
    parseJsonSafe<Insight[]>(r.insights, []).forEach(i => {
      insightCounts[i.type] = (insightCounts[i.type] || 0) + 1
    })
  }
  const insightColors: Record<string, string> = {
    risk: '#ef4444', anomaly: '#f59e0b', opportunity: '#22c55e', observation: '#6366f1',
  }
  const flagsByType: InsightTypeDatum[] = Object.entries(insightCounts)
    .map(([type, count]) => ({ type: type.charAt(0).toUpperCase() + type.slice(1), count, color: insightColors[type] ?? '#9ca3af' }))
    .sort((a, b) => b.count - a.count)

  // Metric status per area
  const metricsByArea: MetricAreaDatum[] = areaCards.map(({ area, reports }) => {
    let positive = 0, negative = 0, warning = 0, neutral = 0
    for (const r of reports) {
      parseJsonSafe<Metric[]>(r.metrics, []).forEach(m => {
        if (m.status === 'positive') positive++
        else if (m.status === 'negative') negative++
        else if (m.status === 'warning') warning++
        else neutral++
      })
    }
    return { area, positive, negative, warning, neutral }
  })

  // ── Export data ──────────────────────────────────────────────────────────

  const exportRows: ExportRow[] = allReports.map(r => {
    const metrics = parseJsonSafe<Metric[]>(r.metrics, [])
    const insights = parseJsonSafe<Insight[]>(r.insights, [])
    const questions = parseJsonSafe<Question[]>(r.questions, [])
    const changes = parseJsonSafe<{ changes: ComparisonChange[] }>(r.comparison, { changes: [] }).changes
    const health = areaHealthScore(changes)
    return {
      title: r.title,
      area: r.area,
      direct: r.directReport?.name ?? '',
      date: new Date(r.createdAt).toISOString().slice(0, 10),
      health,
      positiveMetrics: metrics.filter(m => m.status === 'positive').length,
      negativeMetrics: metrics.filter(m => m.status === 'negative').length,
      warningMetrics: metrics.filter(m => m.status === 'warning').length,
      flags: insights.filter(i => i.type === 'risk' || i.type === 'anomaly').length,
      questions: questions.filter(q => q.priority === 'high').length,
    }
  })

  // ── Empty state ──────────────────────────────────────────────────────────

  if (totalReports === 0) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">No {modeConfig.documentLabelPlural.toLowerCase()} match the current filters.</p>
          </div>
          <DashboardFilters
            areas={allAreas.map(a => a.area)}
            directs={directs}
            activeArea={filterArea}
            activeFrom={filterFrom}
            activeTo={filterTo}
            activeDirect={filterDirect}
          />
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Activity size={32} className="text-gray-200 mb-4" />
          <p className="text-gray-500 text-sm">No {modeConfig.documentLabelPlural.toLowerCase()} in this period.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalReports} {totalReports !== 1 ? modeConfig.documentLabelPlural.toLowerCase() : modeConfig.documentLabel.toLowerCase()} · {areasCount} area{areasCount !== 1 ? 's' : ''}
            {filterArea && ` · ${filterArea}`}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <ExportButton rows={exportRows} period={filterFrom && filterTo ? `${filterFrom} – ${filterTo}` : 'all'} />
          <DashboardFilters
            areas={allAreas.map(a => a.area)}
            directs={directs}
            activeArea={filterArea}
            activeFrom={filterFrom}
            activeTo={filterTo}
            activeDirect={filterDirect}
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Overall health"
          value={`${avgHealth}%`}
          sub={avgHealth >= 60 ? 'On track' : avgHealth >= 40 ? 'Watch closely' : 'Needs attention'}
          color={avgHealth >= 60 ? 'green' : avgHealth >= 40 ? 'amber' : 'red'}
        />
        <StatCard label="Reports" value={String(totalReports)} sub={`across ${areasCount} area${areasCount !== 1 ? 's' : ''}`} color="gray" />
        <StatCard label="Active flags" value={String(flagCount)} sub="risks & anomalies" color={flagCount > 0 ? 'red' : 'green'} />
        <StatCard label="Open questions" value={String(pendingQuestions)} sub="high priority" color={pendingQuestions > 0 ? 'amber' : 'green'} />
      </div>

      {/* Charts */}
      <DashboardCharts
        areaHealth={areaHealth}
        reportsOverTime={reportsOverTime}
        flagsByType={flagsByType}
        metricsByArea={metricsByArea}
      />

      {/* Area cards */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Areas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {areaCards.map(({ area, latest, metrics, changes, health, count }) => {
            const improved = changes.filter(c => c.direction === 'improved').length
            const declined = changes.filter(c => c.direction === 'declined').length
            const trend: 'up' | 'down' | 'flat' =
              improved > declined ? 'up' : declined > improved ? 'down' : 'flat'

            return (
              <div key={area} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-gray-300 hover:shadow-sm transition-all">
                <div className="px-5 pt-5 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AreaBadge area={area} />
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock size={10} />{formatRelativeDate(latest.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendIcon trend={trend} />
                      <HealthBar score={health} />
                    </div>
                  </div>

                  {latest.summary && (
                    <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed mb-4">{latest.summary}</p>
                  )}

                  {metrics.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {metrics.map((m, i) => (
                        <div key={i} className={cn(
                          'rounded-xl px-3 py-2.5',
                          m.status === 'positive' ? 'bg-green-50' :
                          m.status === 'negative' ? 'bg-red-50' :
                          m.status === 'warning'  ? 'bg-amber-50' : 'bg-gray-50'
                        )}>
                          <p className="text-xs text-gray-400 truncate">{m.label}</p>
                          <p className={cn(
                            'text-base font-semibold mt-0.5',
                            m.status === 'positive' ? 'text-green-700' :
                            m.status === 'negative' ? 'text-red-700' :
                            m.status === 'warning'  ? 'text-amber-700' : 'text-gray-900'
                          )}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {changes.length > 0 && (
                  <div className="border-t border-gray-100 px-5 py-3 flex gap-4 overflow-x-auto">
                    {changes.slice(0, 3).map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5 shrink-0 text-xs">
                        <span className={cn('font-bold',
                          c.direction === 'improved' ? 'text-green-600' :
                          c.direction === 'declined' ? 'text-red-600' : 'text-gray-400'
                        )}>
                          {c.direction === 'improved' ? '↑' : c.direction === 'declined' ? '↓' : '→'}
                        </span>
                        <span className="text-gray-500 truncate max-w-[120px]">{c.metric}</span>
                        <span className="text-gray-400 font-mono">{c.current}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
                  <span className="text-xs text-gray-400">{count} {count !== 1 ? modeConfig.documentLabelPlural.toLowerCase() : modeConfig.documentLabel.toLowerCase()}</span>
                  <Link href={`/library?area=${encodeURIComponent(area)}`}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors font-medium">
                    View all <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Flags + Questions as card grids */}
      {(allFlags.length > 0 || allQuestions.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {allFlags.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <AlertTriangle size={11} /> Flags & Risks
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allFlags.slice(0, 6).map((f, i) => (
                  <Link key={i} href={`/reports/${f.reportId}`}
                    className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-red-200 hover:shadow-sm transition-all flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-xs font-bold px-1.5 py-0.5 rounded',
                        f.type === 'risk' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      )}>
                        {f.type}
                      </span>
                      <AreaBadge area={f.area} />
                    </div>
                    <p className="text-sm text-gray-700 leading-snug line-clamp-3">{f.text}</p>
                    <span className="text-xs text-gray-400 group-hover:text-gray-600 flex items-center gap-0.5 mt-auto">
                      View {modeConfig.documentLabel.toLowerCase()} <ArrowRight size={10} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {allQuestions.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <HelpCircle size={11} /> Questions to ask
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allQuestions.slice(0, 6).map((q, i) => (
                  <Link key={i} href={`/reports/${q.reportId}`}
                    className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-200 hover:shadow-sm transition-all flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">?</span>
                      <AreaBadge area={q.area} />
                      {q.directName && <span className="text-xs text-gray-400">{q.directName}</span>}
                    </div>
                    <p className="text-sm text-gray-800 font-medium leading-snug line-clamp-3">{q.text}</p>
                    <span className="text-xs text-gray-400 group-hover:text-gray-600 flex items-center gap-0.5 mt-auto">
                      View {modeConfig.documentLabel.toLowerCase()} <ArrowRight size={10} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

        </div>
      )}

    </div>
  )
}


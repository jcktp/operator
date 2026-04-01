import { prisma } from '@/lib/db'
import { getModeConfig } from '@/lib/mode'
import { cn, formatRelativeDate, parseJsonSafe, parseMetrics } from '@/lib/utils'
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
import IntelligenceBriefClient from './IntelligenceBriefClient'
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

  // Fetch recent timeline events for modes that have the timeline feature
  const recentEvents = modeConfig.features.timeline
    ? await prisma.timelineEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { report: { select: { id: true, title: true, area: true } } },
      })
    : []

  // Modes with entities get the Intelligence Brief — full-width 70/30 workspace
  if (modeConfig.features.entities) {
    // Fetch Intelligence Brief data server-side
    const rawEntities = await prisma.reportEntity.groupBy({
      by: ['name', 'type'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 40,
    })
    const entityMap: Record<string, Array<{ name: string; count: number }>> = {}
    for (const e of rawEntities) {
      if (!entityMap[e.type]) entityMap[e.type] = []
      if (entityMap[e.type].length < 6) entityMap[e.type].push({ name: e.name, count: e._count.id })
    }
    const entityGroups = Object.entries(entityMap)
      .filter(([, items]) => items.length > 0)
      .sort(([a], [b]) => {
        const order = ['person', 'organisation', 'location', 'financial', 'date']
        return (order.indexOf(a) ?? 99) - (order.indexOf(b) ?? 99)
      })
      .slice(0, 4)
      .map(([type, entities]) => ({ type, entities }))

    const briefEvents = await prisma.timelineEvent.findMany({
      orderBy: [{ dateSortKey: 'desc' }, { createdAt: 'desc' }],
      take: 12,
      include: { report: { select: { id: true, title: true, area: true } } },
    })

    const stories = await prisma.story.findMany({ orderBy: { updatedAt: 'desc' }, take: 10 })
    let unverifiedCount = 0
    const storySummaries = stories.map(s => {
      const claims = (JSON.parse(s.claimStatuses ?? '[]') as Array<{ status: string }>) ?? []
      const unverified = claims.filter(c => c.status === 'unverified').length
      unverifiedCount += unverified
      return { id: s.id, title: s.title, unverified, updatedAt: s.updatedAt.toISOString() }
    })

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">Intelligence Brief</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">Entities, timeline, and claims extracted from all documents</p>
        </div>
        <IntelligenceBriefClient
          entityGroups={entityGroups}
          recentEvents={briefEvents.map(e => ({ id: e.id, dateText: e.dateText, event: e.event, report: e.report }))}
          storySummaries={storySummaries}
          totalEntities={rawEntities.length}
          totalEvents={briefEvents.length}
          unverifiedCount={unverifiedCount}
        />
      </div>
    )
  }

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
    const metrics = parseMetrics(latest.metrics)
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
      parseMetrics(r.metrics).forEach(m => {
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
    const metrics = parseMetrics(r.metrics)
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
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">Situation Report</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">No {modeConfig.documentLabelPlural.toLowerCase()} match the current filters.</p>
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
          <Activity size={32} className="text-gray-200 dark:text-zinc-700 mb-4" />
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
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">Situation Report</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
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
        <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Areas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {areaCards.map(({ area, latest, metrics, changes, health, count }) => {
            const improved = changes.filter(c => c.direction === 'improved').length
            const declined = changes.filter(c => c.direction === 'declined').length
            const trend: 'up' | 'down' | 'flat' =
              improved > declined ? 'up' : declined > improved ? 'down' : 'flat'

            return (
              <div key={area} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl overflow-hidden hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-sm transition-all">
                <div className="px-5 pt-5 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AreaBadge area={area} />
                      <span className="text-xs text-gray-400 dark:text-zinc-500 flex items-center gap-1">
                        <Clock size={10} />{formatRelativeDate(latest.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendIcon trend={trend} />
                      <HealthBar score={health} />
                    </div>
                  </div>

                  {latest.summary && (
                    <p className="text-sm text-gray-600 dark:text-zinc-300 line-clamp-2 leading-relaxed mb-4">{latest.summary}</p>
                  )}

                  {metrics.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {metrics.map((m, i) => (
                        <div key={i} className={cn(
                          'rounded-xl px-3 py-2.5',
                          m.status === 'positive' ? 'bg-green-50 dark:bg-green-950' :
                          m.status === 'negative' ? 'bg-red-50 dark:bg-red-950' :
                          m.status === 'warning'  ? 'bg-amber-50 dark:bg-amber-950' : 'bg-gray-50 dark:bg-zinc-800'
                        )}>
                          <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{m.label}</p>
                          <p className={cn(
                            'text-base font-semibold mt-0.5',
                            m.status === 'positive' ? 'text-green-700 dark:text-green-300' :
                            m.status === 'negative' ? 'text-red-700 dark:text-red-300' :
                            m.status === 'warning'  ? 'text-amber-700 dark:text-amber-300' : 'text-gray-900 dark:text-zinc-50'
                          )}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {changes.length > 0 && (
                  <div className="border-t border-gray-100 dark:border-zinc-800 px-5 py-3 flex gap-4 overflow-x-auto">
                    {changes.slice(0, 3).map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5 shrink-0 text-xs">
                        <span className={cn('font-bold',
                          c.direction === 'improved' ? 'text-green-600 dark:text-green-400' :
                          c.direction === 'declined' ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-zinc-500'
                        )}>
                          {c.direction === 'improved' ? '↑' : c.direction === 'declined' ? '↓' : '→'}
                        </span>
                        <span className="text-gray-500 dark:text-zinc-400 truncate max-w-[120px]">{c.metric}</span>
                        <span className="text-gray-400 dark:text-zinc-500 font-mono">{c.current}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-gray-100 dark:border-zinc-800 px-5 py-3 flex items-center justify-between">
                  <span className="text-xs text-gray-400 dark:text-zinc-500">{count} {count !== 1 ? modeConfig.documentLabelPlural.toLowerCase() : modeConfig.documentLabel.toLowerCase()}</span>
                  <Link href={`/library?area=${encodeURIComponent(area)}`}
                    className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-50 transition-colors font-medium">
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
              <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <AlertTriangle size={11} /> Flags & Risks
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allFlags.slice(0, 6).map((f, i) => (
                  <Link key={i} href={`/reports/${f.reportId}`}
                    className="group bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl p-4 hover:border-red-200 dark:hover:border-red-800 hover:shadow-sm transition-all flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-xs font-bold px-1.5 py-0.5 rounded',
                        f.type === 'risk' ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      )}>
                        {f.type}
                      </span>
                      <AreaBadge area={f.area} />
                    </div>
                    <p className="text-sm text-gray-700 dark:text-zinc-200 leading-snug line-clamp-3">{f.text}</p>
                    <span className="text-xs text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-300 flex items-center gap-0.5 mt-auto">
                      View {modeConfig.documentLabel.toLowerCase()} <ArrowRight size={10} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {allQuestions.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <HelpCircle size={11} /> Questions to ask
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allQuestions.slice(0, 6).map((q, i) => (
                  <Link key={i} href={`/reports/${q.reportId}`}
                    className="group bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl p-4 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-sm transition-all flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300">?</span>
                      <AreaBadge area={q.area} />
                      {q.directName && <span className="text-xs text-gray-400 dark:text-zinc-500">{q.directName}</span>}
                    </div>
                    <p className="text-sm text-gray-800 dark:text-zinc-100 font-medium leading-snug line-clamp-3">{q.text}</p>
                    <span className="text-xs text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-300 flex items-center gap-0.5 mt-auto">
                      View {modeConfig.documentLabel.toLowerCase()} <ArrowRight size={10} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {recentEvents.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock size={11} /> Recent Events
              </h2>
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-sm p-5">
                <div className="relative border-l-2 border-gray-200 dark:border-zinc-800 ml-1">
                  {recentEvents.map(e => (
                    <div key={e.id} className="relative pl-6 pb-4 last:pb-0">
                      <span className="absolute left-[-5px] top-[6px] w-2.5 h-2.5 rounded-full border-2 bg-white dark:bg-zinc-900 border-gray-400 dark:border-zinc-500" />
                      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                        <span className="text-[11px] font-mono text-gray-400 dark:text-zinc-500">{e.dateText}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400">{e.report.area}</span>
                      </div>
                      <p className="text-sm text-gray-800 dark:text-zinc-200 leading-snug">{e.event}</p>
                      <Link
                        href={`/reports/${e.report.id}`}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-0.5 block"
                      >
                        {e.report.title}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

        </div>
      )}

    </div>
  )
}


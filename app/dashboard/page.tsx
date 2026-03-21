import { prisma } from '@/lib/db'
import { AREA_COLORS, cn, formatRelativeDate } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, HelpCircle, Activity, ArrowRight, Clock } from 'lucide-react'
import DashboardFilters from './DashboardFilters'

export const dynamic = 'force-dynamic'

// ── Types ──────────────────────────────────────────────────────────────────

interface Metric {
  label: string; value: string; status?: 'positive' | 'negative' | 'neutral' | 'warning'
}
interface Question { text: string; why: string; priority: 'high' | 'medium' | 'low' }
interface Insight { type: 'observation' | 'anomaly' | 'risk' | 'opportunity'; text: string }
interface ComparisonChange {
  metric: string; previous: string; current: string
  direction: 'improved' | 'declined' | 'unchanged' | 'new' | 'removed'
  significance: 'high' | 'medium' | 'low'
}

// ── Helpers ────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date) {
  return Math.abs(Math.round((b.getTime() - a.getTime()) / 86400000))
}

function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try { return JSON.parse(s) as T } catch { return fallback }
}

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

// ── Page ───────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; period?: string; direct?: string }>
}) {
  const { area: filterArea, period: filterPeriod = '30', direct: filterDirect } = await searchParams

  // Date cutoff
  const days = parseInt(filterPeriod) || 30
  const since = filterPeriod === 'all' ? new Date(0) : new Date(Date.now() - days * 86400000)

  const [allReports, directs] = await Promise.all([
    prisma.report.findMany({
      where: {
        ...(filterArea ? { area: filterArea } : {}),
        ...(filterDirect ? { directReportId: filterDirect } : {}),
        ...(filterPeriod !== 'all' ? { createdAt: { gte: since } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { directReport: true },
    }),
    prisma.directReport.findMany({ orderBy: { name: 'asc' } }),
  ])

  // All areas for filter pills
  const allAreas = await prisma.report.findMany({
    select: { area: true }, distinct: ['area'], orderBy: { area: 'asc' },
  })

  // ── Aggregate by area ───────────────────────────────────────────────────

  const areaGroups: Record<string, typeof allReports> = {}
  for (const r of allReports) {
    if (!areaGroups[r.area]) areaGroups[r.area] = []
    areaGroups[r.area].push(r)
  }

  const areaCards = Object.entries(areaGroups).map(([area, reports]) => {
    const latest = reports[0]
    const metrics = parseJson<Metric[]>(latest.metrics, [])
    const changes = parseJson<{ changes: ComparisonChange[] }>(latest.comparison, { changes: [] }).changes
    const health = areaHealthScore(changes)

    // Status counts from latest metrics
    const positive = metrics.filter(m => m.status === 'positive').length
    const negative = metrics.filter(m => m.status === 'negative' || m.status === 'warning').length

    return { area, reports, latest, metrics: metrics.slice(0, 4), changes, health, positive, negative, count: reports.length }
  }).sort((a, b) => a.health - b.health === 0 ? a.area.localeCompare(b.area) : b.health - a.health)

  // ── Cross-area flags & questions ────────────────────────────────────────

  type FlagItem = { text: string; area: string; type: string; reportId: string }
  type QuestionItem = { text: string; area: string; directName?: string; reportId: string; priority: string }

  const allFlags: FlagItem[] = []
  const allQuestions: QuestionItem[] = []

  for (const r of allReports.slice(0, 20)) {
    parseJson<Insight[]>(r.insights, [])
      .filter(i => i.type === 'risk' || i.type === 'anomaly')
      .slice(0, 3)
      .forEach(i => allFlags.push({ text: i.text, area: r.area, type: i.type, reportId: r.id }))

    parseJson<Question[]>(r.questions, [])
      .filter(q => q.priority === 'high')
      .slice(0, 2)
      .forEach(q => allQuestions.push({ text: q.text, area: r.area, directName: r.directReport?.name, reportId: r.id, priority: q.priority }))
  }

  // ── Summary stats ───────────────────────────────────────────────────────

  const totalReports = allReports.length
  const areasCount = Object.keys(areaGroups).length
  const flagCount = allFlags.length
  const pendingQuestions = allQuestions.length

  // Overall health: average across areas
  const avgHealth = areaCards.length
    ? Math.round(areaCards.reduce((s, a) => s + a.health, 0) / areaCards.length)
    : 50

  if (totalReports === 0) {
    return (
      <div className="space-y-6">
        <DashboardFilters areas={allAreas.map(a => a.area)} directs={directs} />
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Activity size={32} className="text-gray-200 mb-4" />
          <p className="text-gray-500 text-sm">No reports match the current filters.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header + filters */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalReports} report{totalReports !== 1 ? 's' : ''} · {areasCount} area{areasCount !== 1 ? 's' : ''}
            {filterArea && ` · ${filterArea}`}
          </p>
        </div>
        <DashboardFilters
          areas={allAreas.map(a => a.area)}
          directs={directs}
          activeArea={filterArea}
          activePeriod={filterPeriod}
          activeDirect={filterDirect}
        />
      </div>

      {/* Summary stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Overall health" value={`${avgHealth}%`} sub={avgHealth >= 60 ? 'On track' : avgHealth >= 40 ? 'Watch closely' : 'Needs attention'}
          color={avgHealth >= 60 ? 'green' : avgHealth >= 40 ? 'amber' : 'red'} />
        <StatCard label="Reports" value={String(totalReports)} sub={`across ${areasCount} area${areasCount !== 1 ? 's' : ''}`} color="gray" />
        <StatCard label="Active flags" value={String(flagCount)} sub="risks & anomalies" color={flagCount > 0 ? 'red' : 'green'} />
        <StatCard label="Open questions" value={String(pendingQuestions)} sub="high priority" color={pendingQuestions > 0 ? 'amber' : 'green'} />
      </div>

      {/* Area cards */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Areas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {areaCards.map(({ area, reports, latest, metrics, changes, health, count }) => {
            const improved = changes.filter(c => c.direction === 'improved').length
            const declined = changes.filter(c => c.direction === 'declined').length
            const trend: 'up' | 'down' | 'flat' =
              improved > declined ? 'up' : declined > improved ? 'down' : 'flat'

            return (
              <div key={area} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-gray-300 hover:shadow-sm transition-all">
                {/* Top bar */}
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

                  {/* Summary */}
                  {latest.summary && (
                    <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed mb-4">
                      {latest.summary}
                    </p>
                  )}

                  {/* Metrics grid */}
                  {metrics.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {metrics.map((m, i) => (
                        <div key={i} className={cn(
                          'rounded-xl px-3 py-2.5',
                          m.status === 'positive' ? 'bg-green-50' :
                          m.status === 'negative' ? 'bg-red-50' :
                          m.status === 'warning' ? 'bg-amber-50' : 'bg-gray-50'
                        )}>
                          <p className="text-xs text-gray-400 truncate">{m.label}</p>
                          <p className={cn(
                            'text-base font-semibold mt-0.5',
                            m.status === 'positive' ? 'text-green-700' :
                            m.status === 'negative' ? 'text-red-700' :
                            m.status === 'warning' ? 'text-amber-700' : 'text-gray-900'
                          )}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Changes strip */}
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

                {/* Footer */}
                <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
                  <span className="text-xs text-gray-400">{count} report{count !== 1 ? 's' : ''}</span>
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

      {/* Flags + Questions */}
      {(allFlags.length > 0 || allQuestions.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {allFlags.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <AlertTriangle size={11} /> Flags & Risks
              </h2>
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {allFlags.slice(0, 6).map((f, i) => (
                  <Link key={i} href={`/reports/${f.reportId}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group">
                    <span className={cn('shrink-0 text-xs font-bold mt-0.5',
                      f.type === 'risk' ? 'text-red-500' : 'text-amber-500')}>
                      {f.type === 'risk' ? '⚠' : '!'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 leading-snug">{f.text}</p>
                      <AreaBadge area={f.area} />
                    </div>
                    <ArrowRight size={12} className="text-gray-300 group-hover:text-gray-500 shrink-0 mt-1" />
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
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {allQuestions.slice(0, 6).map((q, i) => (
                  <Link key={i} href={`/reports/${q.reportId}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group">
                    <span className="shrink-0 text-red-400 font-bold text-xs mt-0.5">?</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 font-medium leading-snug">{q.text}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <AreaBadge area={q.area} />
                        {q.directName && <span className="text-xs text-gray-400">{q.directName}</span>}
                      </div>
                    </div>
                    <ArrowRight size={12} className="text-gray-300 group-hover:text-gray-500 shrink-0 mt-1" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Activity timeline */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Activity</h2>
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {allReports.slice(0, 10).map(r => {
            const metrics = parseJson<Metric[]>(r.metrics, [])
            const pos = metrics.filter(m => m.status === 'positive').length
            const neg = metrics.filter(m => m.status === 'negative' || m.status === 'warning').length
            return (
              <Link key={r.id} href={`/reports/${r.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">{r.title}</span>
                    <AreaBadge area={r.area} />
                    {r.directReport && <span className="text-xs text-gray-400">{r.directReport.name}</span>}
                  </div>
                  {metrics.length > 0 && (
                    <div className="flex items-center gap-3 mt-0.5">
                      {pos > 0 && <span className="text-xs text-green-600">↑ {pos} positive</span>}
                      {neg > 0 && <span className="text-xs text-red-500">↓ {neg} flagged</span>}
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0">{formatRelativeDate(r.createdAt)}</span>
                <ArrowRight size={13} className="text-gray-300 group-hover:text-gray-500 shrink-0" />
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub: string
  color: 'green' | 'red' | 'amber' | 'gray'
}) {
  const colors = {
    green: 'bg-green-50 border-green-100 text-green-700',
    red:   'bg-red-50 border-red-100 text-red-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    gray:  'bg-white border-gray-200 text-gray-900',
  }
  return (
    <div className={cn('border rounded-xl p-4', colors[color])}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-60 mt-0.5">{sub}</p>
    </div>
  )
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up')   return <TrendingUp size={14} className="text-green-500" />
  if (trend === 'down') return <TrendingDown size={14} className="text-red-500" />
  return <Minus size={14} className="text-gray-300" />
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 60 ? 'bg-green-500' : score >= 40 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-gray-400 tabular-nums">{score}%</span>
    </div>
  )
}

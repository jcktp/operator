import { prisma } from '@/lib/db'
import { getModeConfig } from '@/lib/mode'
import { parseJsonSafe, parseMetrics } from '@/lib/utils'
import type { Insight, Question } from '@/lib/utils'
import { Activity } from 'lucide-react'
import { StatCard } from './DashboardCards'
import DashboardFilters from './DashboardFilters'
import DashboardCharts from './DashboardCharts'
import DashboardAreaCards from './DashboardAreaCards'
import DashboardFlagsQuestions from './DashboardFlagsQuestions'
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

 const projectSetting = await prisma.setting.findUnique({ where: { key: 'current_project_id' } })
 const currentProjectId: string | null = projectSetting?.value || null

 const [allReports, directs] = await Promise.all([
 prisma.report.findMany({
 where: {
 ...(currentProjectId ? { projectId: currentProjectId } : {}),
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
 ])
 const modeConfig = getModeConfig(null)

 // Fetch recent timeline events for modes that have the timeline feature
 const recentEvents = modeConfig.features.timeline
 ? await prisma.timelineEvent.findMany({
 orderBy: [{ dateSortKey: 'asc' }, { createdAt: 'asc' }],
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
 <div className="flex flex-col h-full pb-4">
 <div className="shrink-0 pt-2 pb-4">
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Intelligence Brief</h1>
 <p className="text-sm text-[var(--text-muted)] mt-0.5">Entities, timeline, and claims extracted from all documents</p>
 </div>
 <div className="flex-1 min-h-0">
 <IntelligenceBriefClient
 entityGroups={entityGroups}
 recentEvents={briefEvents.map(e => ({ id: e.id, dateText: e.dateText, event: e.event, report: e.report }))}
 storySummaries={storySummaries}
 totalEntities={rawEntities.length}
 totalEvents={briefEvents.length}
 unverifiedCount={unverifiedCount}
 projectId={currentProjectId}
 />
 </div>
 </div>
 )
 }

 const allAreas = await prisma.report.findMany({
 where: currentProjectId ? { projectId: currentProjectId } : {},
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
 <div className="h-full overflow-y-auto pb-8">
 <div className="space-y-8">
 <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
 <div>
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Situation Report</h1>
 <p className="text-sm text-[var(--text-muted)] mt-0.5">No {modeConfig.documentLabelPlural.toLowerCase()} match the current filters.</p>
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
 <Activity size={32} className="text-[var(--border)] mb-4" />
 <p className="text-[var(--text-muted)] text-sm">No {modeConfig.documentLabelPlural.toLowerCase()} in this period.</p>
 </div>
 </div>
 </div>
 )
 }

 return (
 <div className="h-full overflow-y-auto pb-8">
 <div className="space-y-8">

 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
 <div>
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Situation Report</h1>
 <p className="text-sm text-[var(--text-muted)] mt-0.5">
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
 <DashboardAreaCards
 areaCards={areaCards}
 documentLabel={modeConfig.documentLabel}
 documentLabelPlural={modeConfig.documentLabelPlural}
 />

 {/* Flags + Questions + Events */}
 <DashboardFlagsQuestions
 allFlags={allFlags}
 allQuestions={allQuestions}
 recentEvents={recentEvents}
 documentLabel={modeConfig.documentLabel}
 />

 </div>
 </div>
 )
}


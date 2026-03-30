import { prisma } from '@/lib/db'
import { parseJsonSafe } from '@/lib/utils'
import type { Metric, Insight, Question } from '@/lib/utils'
import type { AreaMetricData, MetricPoint } from '@/components/MetricsCharts'
import { FileText, Upload } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import OverviewShell from '@/app/overview/OverviewShell'
import type { OverviewData } from '@/app/overview/OverviewShell'
import OnePagerTab from '@/app/overview/OnePagerTab'
import type { OnePagerReport } from '@/app/overview/OnePagerTab'
import { getModeConfig } from '@/lib/mode'
import { getReportLabels } from '@/lib/mode-labels'
import { isValidSession, SESSION_COOKIE } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function parseMetricNumeric(value: string | undefined | null): number | null {
  if (!value) return null
  let s = value.trim().replace(/[£$€¥₹]/g, '').replace(/,/g, '').replace(/%$/, '')
  const suffixMatch = s.match(/^([-\d.]+)\s*([kmb])$/i)
  if (suffixMatch) {
    const n = parseFloat(suffixMatch[1])
    const mult = ({ k: 1e3, m: 1e6, b: 1e9 } as Record<string, number>)[suffixMatch[2].toLowerCase()] ?? 1
    return isNaN(n) ? null : n * mult
  }
  const numMatch = s.match(/^([-\d.]+)/)
  if (numMatch) { const n = parseFloat(numMatch[1]); return isNaN(n) ? null : n }
  return null
}

/** Monday of the week containing `date` (UTC) */
function weekStart(date: Date): number {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7))
  return d.getTime()
}

function weekLabel(ts: number, index: number): string {
  if (index === 0) return 'Latest'
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) + ' week'
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; week?: string; from?: string; to?: string; area?: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!(await isValidSession(token))) {
    redirect('/login')
  }

  const onboardingRow = await prisma.setting.findUnique({ where: { key: 'onboarding_complete' } })
  if (onboardingRow?.value !== 'true') redirect('/onboarding')

  const params = await searchParams
  const tab = params.tab
  const filterFrom = params.from
  const filterTo = params.to
  const selectedArea = params.area

  const fromDate = filterFrom ? new Date(filterFrom) : null
  const toDate = filterTo ? new Date(filterTo + 'T23:59:59') : null

  const [reports, directs, modeRow] = await Promise.all([
    prisma.report.findMany({
      where: {
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

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center mb-4">
          <FileText size={20} className="text-gray-400 dark:text-zinc-500" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-zinc-50 mb-2">{modeConfig.emptyStateTitle}</h1>
        <p className="text-gray-500 dark:text-zinc-400 text-sm max-w-sm mb-6">{modeConfig.emptyStateBody}</p>
        <Link href="/upload"
          className="inline-flex items-center gap-2 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors">
          <Upload size={15} />{modeConfig.emptyStateCta}
        </Link>
      </div>
    )
  }

  // ── One Pager tab ───────────────────────────────────────────────────────────
  if (tab === 'one-pager') {
    // Group reports into weekly buckets by Monday of their createdAt week
    const bucketMap: Map<number, typeof reports> = new Map()
    for (const r of reports) {
      const key = weekStart(r.createdAt)
      if (!bucketMap.has(key)) bucketMap.set(key, [])
      bucketMap.get(key)!.push(r)
    }
    // Sorted newest first
    const buckets = [...bucketMap.entries()].sort((a, b) => b[0] - a[0])

    const weekIndex = Math.min(
      Math.max(parseInt(params.week ?? '0', 10), 0),
      buckets.length - 1
    )
    const [bucketTs, bucketReports] = buckets[weekIndex] ?? [Date.now(), []]

    const onePagerReports: OnePagerReport[] = bucketReports.map(r => ({
      id: r.id,
      title: r.title,
      area: r.area,
      summary: r.summary,
      metrics: parseJsonSafe<Metric[]>(r.metrics, []),
      insights: parseJsonSafe<Insight[]>(r.insights, []),
      questions: parseJsonSafe<Question[]>(r.questions, []),
      createdAt: r.createdAt.toISOString(),
      directName: r.directReport?.name,
      directTitle: r.directReport?.title,
    }))

    return (
      <OnePagerTab
        reports={onePagerReports}
        weekIndex={weekIndex}
        totalWeeks={buckets.length}
        weekLabel={weekLabel(bucketTs, weekIndex)}
        modeId={modeConfig.id}
      />
    )
  }

  // ── Overview tab ────────────────────────────────────────────────────────────

  // Area counts for sidebar (from full date-filtered set)
  const areaCounts: Record<string, number> = {}
  for (const r of reports) areaCounts[r.area] = (areaCounts[r.area] ?? 0) + 1
  const sidebarAreas = Object.keys(areaCounts).sort().map(name => ({ name, count: areaCounts[name] }))

  const recent = (selectedArea ? reports.filter(r => r.area === selectedArea) : reports).slice(0, 30)

  // Most recent report per area (all areas view) OR up to 6 recent reports (single area view)
  let activeAreas: typeof reports
  if (selectedArea) {
    activeAreas = recent.slice(0, 6)
  } else {
    const areaMap: Record<string, typeof reports[0]> = {}
    for (const r of recent) {
      if (!areaMap[r.area]) areaMap[r.area] = r
    }
    activeAreas = Object.values(areaMap)
  }

  type FlagItem = { text: string; type: string; reportTitle: string; reportId: string }
  type QuestionItem = { text: string; reportTitle: string; directName?: string; reportId: string }
  type ResolvedItem = { text: string; area: string; reportId: string }

  const topInsights: FlagItem[] = []
  const topQuestions: QuestionItem[] = []
  const resolvedFlagItems: ResolvedItem[] = []

  for (const r of recent.slice(0, 10)) {
    parseJsonSafe<Insight[]>(r.insights, [])
      .filter(i => i.type === 'risk' || i.type === 'anomaly')
      .forEach(i => topInsights.push({ text: i.text, type: i.type, reportTitle: r.title, reportId: r.id }))

    parseJsonSafe<Question[]>(r.questions, [])
      .filter(q => q.priority === 'high')
      .forEach(q => topQuestions.push({ text: q.text, reportTitle: r.title, directName: r.directReport?.name, reportId: r.id }))

    parseJsonSafe<string[]>(r.resolvedFlags, [])
      .forEach(text => resolvedFlagItems.push({ text, area: r.area, reportId: r.id }))
  }

  const labels = getReportLabels(modeConfig.id)
  const contextLines: string[] = [
    `${modeConfig.label} overview — ${reports.length} ${modeConfig.documentLabelPlural.toLowerCase()} across ${activeAreas.length} ${modeConfig.collectionLabelPlural.toLowerCase()}.`,
    '',
    `${modeConfig.collectionLabelPlural.toUpperCase()}:`,
    ...activeAreas.map(r => {
      const metrics = parseJsonSafe<Metric[]>(r.metrics, []).slice(0, 4)
      return `- ${r.area}: ${r.summary ?? r.title}${metrics.length ? '\n  ' + labels.onePagerMetrics + ': ' + metrics.map(m => `${m.label} ${m.value}`).join(', ') : ''}`
    }),
  ]
  if (topInsights.length > 0) {
    contextLines.push('', `ACTIVE ${labels.flagsPanel.toUpperCase()}:`)
    topInsights.slice(0, 5).forEach(f => contextLines.push(`- [${f.type}] ${f.text}`))
  }
  if (topQuestions.length > 0) {
    contextLines.push('', `${labels.questionsPanel.toUpperCase()}:`)
    topQuestions.slice(0, 5).forEach(q => contextLines.push(`- ${q.text}${q.directName ? ` (${labels.questionsPersonPrefix.toLowerCase()} ${q.directName})` : ''}`))
  }

  // ── Metric time-series per area ─────────────────────────────────────────────
  // Group all recent reports by area, sorted oldest→newest
  const byArea: Record<string, typeof reports> = {}
  for (const r of [...recent].reverse()) {
    if (!byArea[r.area]) byArea[r.area] = []
    byArea[r.area].push(r)
  }

  const areaMetrics: AreaMetricData[] = Object.entries(byArea).map(([area, areaReports]) => {
    // Track first-seen label text per normalized key
    const labelText: Record<string, string> = {}
    const labelPoints: Record<string, MetricPoint[]> = {}
    for (const r of areaReports) {
      for (const m of parseJsonSafe<Metric[]>(r.metrics, []).filter(m => m.label && m.value)) {
        const key = m.label.trim().toLowerCase()
        if (!labelText[key]) labelText[key] = m.label.trim()
        if (!labelPoints[key]) labelPoints[key] = []
        labelPoints[key].push({
          date: (r.reportDate ?? r.createdAt).toISOString(),
          displayValue: m.value,
          numericValue: parseMetricNumeric(m.value),
          status: m.status,
        })
      }
    }
    const metrics = Object.keys(labelPoints)
      .filter(key => labelPoints[key].length >= 2)
      .map(key => ({ label: labelText[key], points: labelPoints[key] }))
    return { area, metrics }
  })

  const data: OverviewData = {
    stats: {
      totalReports: reports.length,
      areasCount: selectedArea ? 1 : activeAreas.length,
      directsCount: directs.length,
    },
    areas: sidebarAreas,
    selectedArea,
    activeAreas: activeAreas.map(r => ({
      id: r.id,
      area: r.area,
      title: r.title,
      summary: r.summary,
      metrics: parseJsonSafe<Metric[]>(r.metrics, []),
      createdAt: r.createdAt.toISOString(),
    })),
    topInsights: topInsights.slice(0, 5),
    topQuestions: topQuestions.slice(0, 5),
    resolvedFlagItems: resolvedFlagItems.slice(0, 6),
    recentReports: recent.slice(0, 8).map(r => ({
      id: r.id,
      title: r.title,
      area: r.area,
      createdAt: r.createdAt.toISOString(),
      directName: r.directReport?.name,
      directTitle: r.directReport?.title,
    })),
    context: contextLines.join('\n'),
    areaMetrics: areaMetrics.filter(a => a.metrics.length > 0),
  }

  return <OverviewShell data={data} activeFrom={filterFrom} activeTo={filterTo} />
}

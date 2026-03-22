import { prisma } from '@/lib/db'
import { FileText, Upload } from 'lucide-react'
import Link from 'next/link'
import OverviewShell from '@/app/overview/OverviewShell'
import type { OverviewData } from '@/app/overview/OverviewShell'

export const dynamic = 'force-dynamic'

interface Metric { label: string; value: string; status?: string }
interface Insight { type: string; text: string }
interface Question { text: string; why: string; priority: string }

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try { return JSON.parse(s) as T } catch { return fallback }
}

export default async function OverviewPage() {
  const [reports, directs] = await Promise.all([
    prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { directReport: true },
    }),
    prisma.directReport.findMany({ orderBy: { name: 'asc' } }),
  ])

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
          <FileText size={20} className="text-gray-400" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">No reports yet</h1>
        <p className="text-gray-500 text-sm max-w-sm mb-6">
          Upload your first report to get a unified view of your business.
        </p>
        <Link href="/upload"
          className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
          <Upload size={15} />Add first report
        </Link>
      </div>
    )
  }

  // Most recent report per area
  const areaMap: Record<string, typeof reports[0]> = {}
  for (const r of reports) {
    if (!areaMap[r.area]) areaMap[r.area] = r
  }
  const activeAreas = Object.values(areaMap)

  // Flags, questions, resolved flags
  type FlagItem = { text: string; type: string; reportTitle: string; reportId: string }
  type QuestionItem = { text: string; reportTitle: string; directName?: string; reportId: string }
  type ResolvedItem = { text: string; area: string; reportId: string }

  const topInsights: FlagItem[] = []
  const topQuestions: QuestionItem[] = []
  const resolvedFlagItems: ResolvedItem[] = []

  for (const r of reports.slice(0, 10)) {
    safeJson<Insight[]>(r.insights, [])
      .filter(i => i.type === 'risk' || i.type === 'anomaly')
      .forEach(i => topInsights.push({ text: i.text, type: i.type, reportTitle: r.title, reportId: r.id }))

    safeJson<Question[]>(r.questions, [])
      .filter(q => q.priority === 'high')
      .forEach(q => topQuestions.push({ text: q.text, reportTitle: r.title, directName: r.directReport?.name, reportId: r.id }))

    safeJson<string[]>(r.resolvedFlags, [])
      .forEach(text => resolvedFlagItems.push({ text, area: r.area, reportId: r.id }))
  }

  // Build Dispatch context string
  const contextLines: string[] = [
    `Business overview — ${reports.length} reports across ${activeAreas.length} areas.`,
    '',
    'AREAS:',
    ...activeAreas.map(r => {
      const metrics = safeJson<Metric[]>(r.metrics, []).slice(0, 4)
      return `- ${r.area}: ${r.summary ?? r.title}${metrics.length ? '\n  Metrics: ' + metrics.map(m => `${m.label} ${m.value}`).join(', ') : ''}`
    }),
  ]
  if (topInsights.length > 0) {
    contextLines.push('', 'ACTIVE FLAGS:')
    topInsights.slice(0, 5).forEach(f => contextLines.push(`- [${f.type}] ${f.text}`))
  }
  if (topQuestions.length > 0) {
    contextLines.push('', 'OPEN QUESTIONS:')
    topQuestions.slice(0, 5).forEach(q => contextLines.push(`- ${q.text}${q.directName ? ` (ask ${q.directName})` : ''}`))
  }

  const data: OverviewData = {
    stats: {
      totalReports: reports.length,
      areasCount: activeAreas.length,
      directsCount: directs.length,
    },
    activeAreas: activeAreas.map(r => ({
      id: r.id,
      area: r.area,
      title: r.title,
      summary: r.summary,
      metrics: safeJson<Metric[]>(r.metrics, []),
      createdAt: r.createdAt.toISOString(),
    })),
    topInsights: topInsights.slice(0, 5),
    topQuestions: topQuestions.slice(0, 5),
    resolvedFlagItems: resolvedFlagItems.slice(0, 6),
    recentReports: reports.slice(0, 8).map(r => ({
      id: r.id,
      title: r.title,
      area: r.area,
      createdAt: r.createdAt.toISOString(),
      directName: r.directReport?.name,
      directTitle: r.directReport?.title,
    })),
    context: contextLines.join('\n'),
  }

  return <OverviewShell data={data} />
}

import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getModeConfig } from '@/lib/mode'
import { parseJsonSafe } from '@/lib/utils'
import type { Metric } from '@/lib/utils'
import MetricsClient from './MetricsClient'

export const dynamic = 'force-dynamic'

export default async function MetricsPage() {
  const [modeRow, projectSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'app_mode' } }),
    prisma.setting.findUnique({ where: { key: 'current_project_id' } }),
  ])
  const modeConfig = getModeConfig(modeRow?.value)
  const currentProjectId = projectSetting?.value || null

  if (!modeConfig.features.metricsBoard) notFound()

  const reports = await prisma.report.findMany({
    where: { metrics: { not: null }, ...(currentProjectId ? { projectId: currentProjectId } : {}) },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, area: true, reportDate: true, createdAt: true, metrics: true,
      directReport: { select: { name: true } } },
  })

  // Flatten all metrics with source info
  const allMetrics = reports.flatMap(r => {
    const parsed = parseJsonSafe<Record<string, unknown>[]>(r.metrics, [])
      .map(m => ({ ...m, label: (((m.label ?? m.name) as string | undefined) ?? '').trim() }))
      .filter(m => m.label) as Metric[]
    return parsed.map(m => ({
      ...m,
      reportId: r.id,
      reportTitle: r.title,
      area: r.area,
      reportDate: r.reportDate?.toISOString() ?? r.createdAt.toISOString(),
      sourceName: r.directReport?.name ?? null,
    }))
  })

  const usedAreas = [...new Set(allMetrics.map(m => m.area))].sort()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">Metrics</h1>
        <p className="text-gray-500 dark:text-zinc-400 text-sm mt-0.5">
          All KPIs and metrics extracted from your {modeConfig.documentLabelPlural.toLowerCase()}, across every {modeConfig.collectionLabel.toLowerCase()}.
        </p>
      </div>

      {allMetrics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center mb-4">
            <span className="text-2xl">📊</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-zinc-400">No metrics yet.</p>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
            Upload and analyse {modeConfig.documentLabelPlural.toLowerCase()} to see KPIs here.
          </p>
        </div>
      ) : (
        <MetricsClient metrics={allMetrics} usedAreas={usedAreas} modeConfig={{
          documentLabel: modeConfig.documentLabel,
          documentLabelPlural: modeConfig.documentLabelPlural,
          collectionLabel: modeConfig.collectionLabel,
        }} />
      )}
    </div>
  )
}

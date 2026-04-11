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
 const currentMode = modeRow?.value ?? ''
 const modeConfig = getModeConfig(currentMode)
 const currentProjectId = projectSetting?.value || null

 if (!modeConfig.features.metricsBoard) notFound()

 const modeWhere = currentMode ? { OR: [{ mode: currentMode }, { mode: '' }] } : {}
 const reports = await prisma.report.findMany({
 where: { metrics: { not: null }, ...(currentProjectId ? { projectId: currentProjectId } : modeWhere) },
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
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Metrics</h1>
 <p className="text-[var(--text-muted)] text-sm mt-0.5">
 All KPIs and metrics extracted from your {modeConfig.documentLabelPlural.toLowerCase()}, across every {modeConfig.collectionLabel.toLowerCase()}.
 </p>
 </div>

 {allMetrics.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-20 text-center">
 <div className="w-12 h-12 bg-[var(--surface-2)] rounded-xl flex items-center justify-center mb-4">
 <span className="text-2xl">📊</span>
 </div>
 <p className="text-sm text-[var(--text-muted)]">No metrics yet.</p>
 <p className="text-xs text-[var(--text-muted)] mt-1">
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

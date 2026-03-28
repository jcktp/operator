import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getModeConfig } from '@/lib/mode'
import TimelineClient from './TimelineClient'

export const dynamic = 'force-dynamic'

export default async function TimelinePage() {
  const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  const modeConfig = getModeConfig(modeRow?.value)

  // Available for any mode that has timeline feature AND exposes it in nav
  if (!modeConfig.features.timeline || !modeConfig.features.extraNavItems.some(n => n.href === '/timeline')) {
    notFound()
  }

  const navItem = modeConfig.features.extraNavItems.find(n => n.href === '/timeline')

  // Fetch all timeline events with their source report info
  const events = await prisma.timelineEvent.findMany({
    orderBy: [{ dateSortKey: 'asc' }, { createdAt: 'asc' }],
    include: {
      report: {
        select: { id: true, title: true, area: true, directReport: { select: { name: true } } },
      },
    },
  })

  const serialized = events.map(e => ({
    id: e.id,
    dateText: e.dateText,
    dateSortKey: e.dateSortKey,
    event: e.event,
    reportId: e.report.id,
    reportTitle: e.report.title,
    area: e.report.area,
    sourceName: e.report.directReport?.name ?? null,
  }))

  const usedAreas = [...new Set(serialized.map(e => e.area))].sort()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{navItem?.label ?? 'Timeline'}</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          All events extracted from your {modeConfig.documentLabelPlural.toLowerCase()}, in chronological order.
        </p>
      </div>

      {serialized.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
            <span className="text-2xl">🕐</span>
          </div>
          <p className="text-sm text-gray-500">No timeline events yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Upload and analyse {modeConfig.documentLabelPlural.toLowerCase()} — events will be extracted automatically.
          </p>
        </div>
      ) : (
        <TimelineClient events={serialized} usedAreas={usedAreas} modeConfig={{
          documentLabel: modeConfig.documentLabel,
          documentLabelPlural: modeConfig.documentLabelPlural,
          collectionLabel: modeConfig.collectionLabel,
        }} />
      )}
    </div>
  )
}

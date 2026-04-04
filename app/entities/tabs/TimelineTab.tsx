import { Clock } from 'lucide-react'
import { prisma } from '@/lib/db'
import type { ModeConfig } from '@/lib/mode'
import TimelineTabClient from './TimelineTabClient'

interface Props {
  modeConfig: ModeConfig
  projectId?: string | null
}

export default async function TimelineTab({ modeConfig, projectId }: Props) {
  const events = await prisma.timelineEvent.findMany({
    where: projectId ? { report: { projectId } } : undefined,
    orderBy: [{ dateSortKey: 'asc' }, { createdAt: 'asc' }],
    include: {
      report: {
        select: { id: true, title: true, area: true, storyName: true },
      },
    },
  })

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center mb-4">
          <Clock size={20} className="text-gray-400 dark:text-zinc-500" />
        </div>
        <p className="text-sm text-gray-500 dark:text-zinc-400">No timeline events yet.</p>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
          Upload and analyse {modeConfig.documentLabelPlural.toLowerCase()} — events will be extracted automatically.
        </p>
      </div>
    )
  }

  const serialized = events.map(e => ({
    id: e.id,
    dateText: e.dateText,
    dateSortKey: e.dateSortKey,
    event: e.event,
    reportId: e.report.id,
    reportTitle: e.report.title,
    area: e.report.area,
    storyName: e.report.storyName ?? null,
    sourceName: null,
  }))

  const areaCount = new Set(serialized.map(e => e.area)).size

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 dark:text-zinc-500">
        {events.length} event{events.length !== 1 ? 's' : ''} across {areaCount} area{areaCount !== 1 ? 's' : ''}
      </p>
      <TimelineTabClient events={serialized} />
    </div>
  )
}

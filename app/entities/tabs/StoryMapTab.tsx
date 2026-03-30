import { prisma } from '@/lib/db'
import StoryMapTabClient from './StoryMapTabClient'
import type { RawLocation } from './StoryMapClient'

export default async function StoryMapTab() {
  // Fetch all location entities grouped by name
  const locationEntities = await prisma.reportEntity.findMany({
    where: { type: 'location' },
    include: {
      report: { select: { id: true, title: true, area: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Group by name
  const grouped: Record<string, RawLocation> = {}
  for (const e of locationEntities) {
    if (!grouped[e.name]) {
      grouped[e.name] = {
        name: e.name,
        reportIds: [],
        reportTitles: {},
        reportAreas: {},
        contexts: [],
      }
    }
    const g = grouped[e.name]
    if (!g.reportIds.includes(e.reportId)) {
      g.reportIds.push(e.reportId)
      g.reportTitles[e.reportId] = e.report.title
      g.reportAreas[e.reportId] = e.report.area
    }
    if (e.context && !g.contexts.includes(e.context)) {
      g.contexts.push(e.context)
    }
  }

  // Sort by frequency
  const locations = Object.values(grouped).sort((a, b) => b.reportIds.length - a.reportIds.length)

  return <StoryMapTabClient locations={locations} />
}

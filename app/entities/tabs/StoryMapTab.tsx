import { prisma } from '@/lib/db'
import StoryMapTabClient from './StoryMapTabClient'
import type { RawLocation } from './StoryMapClient'

export default async function StoryMapTab() {
  // Fetch all location entities grouped by name
  const locationEntities = await prisma.reportEntity.findMany({
    where: { type: 'location' },
    include: {
      report: { select: { id: true, title: true, area: true, storyName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Collect all story names for the filter
  const storyNames = [...new Set(
    locationEntities.map(e => e.report.storyName).filter(Boolean) as string[]
  )].sort()

  // Group by name
  const grouped: Record<string, RawLocation> = {}
  for (const e of locationEntities) {
    if (!grouped[e.name]) {
      grouped[e.name] = {
        name: e.name,
        reportIds: [],
        reportTitles: {},
        reportAreas: {},
        reportStoryNames: {},
        contexts: [],
        contextsByReport: [],
      }
    }
    const g = grouped[e.name]
    if (!g.reportIds.includes(e.reportId)) {
      g.reportIds.push(e.reportId)
      g.reportTitles[e.reportId] = e.report.title
      g.reportAreas[e.reportId] = e.report.area
      if (e.report.storyName) g.reportStoryNames[e.reportId] = e.report.storyName
    }
    if (e.context && !g.contexts.includes(e.context)) {
      g.contexts.push(e.context)
    }
    // Build per-report context entries for the inspector (each unique context per report)
    if (e.context && !g.contextsByReport.some(c => c.reportId === e.reportId && c.context === e.context)) {
      g.contextsByReport.push({
        reportId: e.reportId,
        reportTitle: e.report.title,
        area: e.report.area,
        context: e.context,
      })
    }
  }

  // Sort by frequency
  const locations = Object.values(grouped).sort((a, b) => b.reportIds.length - a.reportIds.length)

  return <StoryMapTabClient locations={locations} storyNames={storyNames} />
}

/**
 * POST /api/storyline/[id]/refresh
 * Re-runs entity extraction and timeline extraction for all documents assigned to a story,
 * without requiring re-upload. Deletes existing ReportEntity and TimelineEvent rows for
 * those reports then re-extracts from stored rawContent.
 *
 * Body: { type: 'entities' | 'timeline' | 'all' }
 * Returns: { entitiesRefreshed: number, eventsRefreshed: number }
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { extractEntities, extractTimeline } from '@/lib/ai'
import { loadAiSettings } from '@/lib/settings'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { type = 'all' } = await req.json().catch(() => ({})) as { type?: string }

  const story = await prisma.story.findUnique({ where: { id } })
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })

  let reportIds: string[]
  try { reportIds = JSON.parse(story.reportIds) as string[] } catch { reportIds = [] }
  if (reportIds.length === 0) return NextResponse.json({ error: 'No documents assigned to this story' }, { status: 400 })

  const reports = await prisma.report.findMany({
    where: { id: { in: reportIds } },
    select: { id: true, title: true, area: true, rawContent: true },
  })

  await loadAiSettings()

  let entitiesRefreshed = 0
  let eventsRefreshed = 0

  for (const report of reports) {
    if (type === 'entities' || type === 'all') {
      try {
        const entities = await extractEntities(report.rawContent, report.title, report.area)
        await prisma.reportEntity.deleteMany({ where: { reportId: report.id } })
        if (entities.length > 0) {
          await prisma.reportEntity.createMany({
            data: entities.map(e => ({
              reportId: report.id,
              type: e.type,
              name: e.name,
              context: e.context ?? null,
            })),
          })
          entitiesRefreshed += entities.length
        }
      } catch (e) {
        console.error(`[story-refresh] entity extraction failed for ${report.id}:`, e)
      }
    }

    if (type === 'timeline' || type === 'all') {
      try {
        const events = await extractTimeline(report.rawContent, report.title)
        await prisma.timelineEvent.deleteMany({ where: { reportId: report.id } })
        if (events.length > 0) {
          await prisma.timelineEvent.createMany({
            data: events.map(e => ({
              reportId: report.id,
              dateText: e.dateText,
              dateSortKey: e.dateSortKey ?? null,
              event: e.event,
            })),
          })
          eventsRefreshed += events.length
        }
      } catch (e) {
        console.error(`[story-refresh] timeline extraction failed for ${report.id}:`, e)
      }
    }
  }

  return NextResponse.json({ entitiesRefreshed, eventsRefreshed })
}

/**
 * POST /api/journal/[id]/structure/refresh
 * Re-runs entity and/or timeline extraction for all reports referenced by this entry's structure.
 * Body: { type: 'entities' | 'timeline' | 'all' }
 * Returns: { entitiesRefreshed, eventsRefreshed }
 */
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { extractEntities, extractTimeline } from '@/lib/ai'
import { loadAiSettings } from '@/lib/settings'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params
  const { type = 'all' } = await req.json().catch(() => ({})) as { type?: string }

  const structure = await prisma.entryStructure.findUnique({ where: { entryId: id } })
  if (!structure) return NextResponse.json({ error: 'Entry has no structure attached' }, { status: 404 })

  let reportIds: string[]
  try { reportIds = JSON.parse(structure.reportIds) as string[] } catch { reportIds = [] }
  if (reportIds.length === 0) {
    return NextResponse.json({ error: 'No documents referenced by this entry' }, { status: 400 })
  }

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
        console.error(`[entry-refresh] entity extraction failed for ${report.id}:`, e)
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
        console.error(`[entry-refresh] timeline extraction failed for ${report.id}:`, e)
      }
    }
  }

  return NextResponse.json({ entitiesRefreshed, eventsRefreshed })
}

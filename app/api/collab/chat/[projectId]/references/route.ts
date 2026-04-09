import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { requireCollabEnabled } from '@/lib/collab/feature-flag'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Returns entities, documents, and timeline events scoped to a project for the reference picker. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = await requireCollabEnabled()
  if (disabled) return disabled

  const { projectId } = await params
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'entity'
  const q = searchParams.get('q')?.trim().toLowerCase() ?? ''

  if (type === 'entity') {
    const reports = await prisma.report.findMany({
      where: { projectId },
      select: { id: true },
    })
    const reportIds = reports.map(r => r.id)
    if (reportIds.length === 0) return NextResponse.json({ items: [] })

    const entities = await prisma.reportEntity.findMany({
      where: {
        reportId: { in: reportIds },
        ...(q ? { name: { contains: q } } : {}),
      },
      orderBy: { name: 'asc' },
      take: 20,
    })
    // Deduplicate by name
    const seen = new Set<string>()
    const items = entities
      .filter(e => {
        if (seen.has(e.name)) return false
        seen.add(e.name)
        return true
      })
      .map(e => ({ type: 'entity', id: e.id, label: e.name, meta: e.type }))

    return NextResponse.json({ items })
  }

  if (type === 'document') {
    const reports = await prisma.report.findMany({
      where: {
        projectId,
        ...(q ? { title: { contains: q } } : {}),
        removedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, title: true, fileType: true, createdAt: true },
    })
    const items = reports.map(r => ({ type: 'document', id: r.id, label: r.title, meta: r.fileType }))
    return NextResponse.json({ items })
  }

  if (type === 'timeline') {
    const reports = await prisma.report.findMany({
      where: { projectId },
      select: { id: true },
    })
    const reportIds = reports.map(r => r.id)
    if (reportIds.length === 0) return NextResponse.json({ items: [] })

    const events = await prisma.timelineEvent.findMany({
      where: {
        reportId: { in: reportIds },
        ...(q ? { OR: [{ dateText: { contains: q } }, { event: { contains: q } }] } : {}),
      },
      orderBy: { dateSortKey: 'asc' },
      take: 20,
    })
    const items = events.map(e => ({
      type: 'timeline',
      id: e.id,
      label: `${e.dateText} — ${e.event.slice(0, 60)}`,
      meta: e.dateText,
    }))
    return NextResponse.json({ items })
  }

  return NextResponse.json({ items: [] })
}

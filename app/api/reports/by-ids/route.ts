import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { parseJsonSafe } from '@/lib/utils'
import type { Insight } from '@/lib/utils'

// GET /api/reports/by-ids?id=x&id=y&id=z
// Returns summary + parsed insights + entities for each report — used by the Story workspace
// Documents panel to render previews + clickable entity/insight chips.
export async function GET(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const url = new URL(req.url)
  const ids = url.searchParams.getAll('id').filter(Boolean)
  if (ids.length === 0) {
    return NextResponse.json({ reports: [] })
  }

  const [reports, entities] = await Promise.all([
    prisma.report.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, area: true, summary: true, insights: true },
    }),
    prisma.reportEntity.findMany({
      where: { reportId: { in: ids } },
      select: { id: true, reportId: true, type: true, name: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const entitiesByReport = new Map<string, Array<{ id: string; type: string; name: string }>>()
  for (const e of entities) {
    if (!entitiesByReport.has(e.reportId)) entitiesByReport.set(e.reportId, [])
    entitiesByReport.get(e.reportId)!.push({ id: e.id, type: e.type, name: e.name })
  }

  const result = reports.map(r => ({
    id: r.id,
    title: r.title,
    area: r.area,
    summary: r.summary,
    insights: parseJsonSafe<Insight[]>(r.insights, []).map(i => ({ type: i.type, text: i.text })),
    entities: entitiesByReport.get(r.id) ?? [],
  }))

  // Preserve the requested order (so the panel shows attachments in the order the user added them)
  const orderedResult = ids
    .map(id => result.find(r => r.id === id))
    .filter((r): r is NonNullable<typeof r> => !!r)

  return NextResponse.json({ reports: orderedResult })
}

/**
 * GET /api/entities/by-reports?reportIds=id1,id2,...
 * Returns non-location entities grouped by report, for the map inspector panel.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const ids = req.nextUrl.searchParams.get('reportIds')
  if (!ids) return NextResponse.json({ results: [] })

  const reportIds = ids.split(',').filter(Boolean).slice(0, 20)

  const entities = await prisma.reportEntity.findMany({
    where: {
      reportId: { in: reportIds },
      type: { not: 'location' },
    },
    select: { reportId: true, name: true, type: true },
    orderBy: { createdAt: 'asc' },
  })

  // Group by reportId, deduplicate by name+type
  const grouped: Record<string, Array<{ name: string; type: string }>> = {}
  const seen: Record<string, Set<string>> = {}
  for (const e of entities) {
    if (!grouped[e.reportId]) { grouped[e.reportId] = []; seen[e.reportId] = new Set() }
    const key = `${e.type}::${e.name}`
    if (!seen[e.reportId].has(key)) {
      grouped[e.reportId].push({ name: e.name, type: e.type })
      seen[e.reportId].add(key)
    }
  }

  return NextResponse.json({ results: grouped })
}

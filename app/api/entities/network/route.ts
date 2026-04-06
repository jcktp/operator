import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export interface NetworkNode {
  id: string
  name: string
  type: string
  count: number
}

export interface NetworkEdge {
  source: string
  target: string
  weight: number
}

export interface NetworkData {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
}

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { searchParams } = req.nextUrl
  const projectId = searchParams.get('projectId')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '120'), 200)
  const minCount = parseInt(searchParams.get('minCount') ?? '1')

  // Fetch all entity entries, optionally scoped to a project's reports
  let reportIds: string[] | null = null
  if (projectId) {
    const reports = await prisma.report.findMany({
      where: { projectId },
      select: { id: true },
    })
    reportIds = reports.map(r => r.id)
    if (reportIds.length === 0) return NextResponse.json({ nodes: [], edges: [] } satisfies NetworkData)
  }

  const allEntries = await prisma.reportEntity.findMany({
    where: reportIds ? { reportId: { in: reportIds } } : {},
    select: { name: true, type: true, reportId: true },
  })

  // Group by name → { type, reportIds }
  const entityMap = new Map<string, { type: string; reportIds: Set<string> }>()
  for (const e of allEntries) {
    if (!entityMap.has(e.name)) entityMap.set(e.name, { type: e.type, reportIds: new Set() })
    entityMap.get(e.name)!.reportIds.add(e.reportId)
  }

  // Build nodes, filter by minCount, sort by count desc, cap at limit
  const nodes: NetworkNode[] = [...entityMap.entries()]
    .filter(([, d]) => d.reportIds.size >= minCount)
    .sort((a, b) => b[1].reportIds.size - a[1].reportIds.size)
    .slice(0, limit)
    .map(([name, d]) => ({ id: name, name, type: d.type, count: d.reportIds.size }))

  const visibleIds = new Set(nodes.map(n => n.id))

  // Build edges between visible nodes based on shared report IDs
  const edges: NetworkEdge[] = []
  const seen = new Set<string>()
  const visibleList = nodes.map(n => n.id)

  for (let i = 0; i < visibleList.length; i++) {
    for (let j = i + 1; j < visibleList.length; j++) {
      const a = visibleList[i]
      const b = visibleList[j]
      const pairKey = `${a}|||${b}`
      if (seen.has(pairKey)) continue
      seen.add(pairKey)

      if (!visibleIds.has(a) || !visibleIds.has(b)) continue
      const aIds = entityMap.get(a)!.reportIds
      const bIds = entityMap.get(b)!.reportIds
      const shared = [...aIds].filter(id => bIds.has(id)).length
      if (shared > 0) edges.push({ source: a, target: b, weight: shared })
    }
  }

  return NextResponse.json({ nodes, edges } satisfies NetworkData)
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export interface GraphNode {
  id: string
  name: string
  type: string
  count: number
}

export interface GraphEdge {
  source: string
  target: string
  weight: number // number of shared reports
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  centre: string
}

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const name = req.nextUrl.searchParams.get('name') ?? ''
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  // Find all reports that contain this entity
  const centreEntries = await prisma.reportEntity.findMany({
    where: { name: { equals: name } },
    select: { reportId: true, type: true },
  })

  const centreType = centreEntries[0]?.type ?? 'person'
  const centreReportIds = centreEntries.map(e => e.reportId)

  if (centreReportIds.length === 0) {
    return NextResponse.json({ nodes: [], edges: [], centre: name })
  }

  // Find all other entities in those same reports
  const coEntries = await prisma.reportEntity.findMany({
    where: {
      reportId: { in: centreReportIds },
      name: { not: name },
    },
    select: { name: true, type: true, reportId: true },
  })

  // Group co-entities: count how many shared reports each has
  const coEntityMap = new Map<string, { type: string; reportIds: Set<string> }>()
  for (const entry of coEntries) {
    const key = entry.name
    if (!coEntityMap.has(key)) {
      coEntityMap.set(key, { type: entry.type, reportIds: new Set<string>() })
    }
    coEntityMap.get(key)!.reportIds.add(entry.reportId)
  }

  // Build nodes — centre + top co-entities (max 30 for readability)
  const centreNode: GraphNode = {
    id: name,
    name,
    type: centreType,
    count: centreReportIds.length,
  }

  const coNodes: GraphNode[] = [...coEntityMap.entries()]
    .sort((a, b) => b[1].reportIds.size - a[1].reportIds.size)
    .slice(0, 30)
    .map(([n, data]) => ({
      id: n,
      name: n,
      type: data.type,
      count: data.reportIds.size,
    }))

  const nodes = [centreNode, ...coNodes]

  // Edges: centre → each co-entity
  const centreEdges: GraphEdge[] = coNodes.map(node => ({
    source: name,
    target: node.id,
    weight: coEntityMap.get(node.id)!.reportIds.size,
  }))

  // Edges: co-entity ↔ co-entity (shared reports, excluding centre)
  const visibleIds = new Set(coNodes.map(n => n.id))
  const coEdges: GraphEdge[] = []
  const seenPairs = new Set<string>()
  for (const [nameA, dataA] of coEntityMap) {
    if (!visibleIds.has(nameA)) continue
    for (const [nameB, dataB] of coEntityMap) {
      if (!visibleIds.has(nameB)) continue
      if (nameA >= nameB) continue // deduplicate A↔B and B↔A
      const pairKey = `${nameA}|||${nameB}`
      if (seenPairs.has(pairKey)) continue
      seenPairs.add(pairKey)
      const sharedCount = [...dataA.reportIds].filter(rid => dataB.reportIds.has(rid)).length
      if (sharedCount > 0) {
        coEdges.push({ source: nameA, target: nameB, weight: sharedCount })
      }
    }
  }

  const edges: GraphEdge[] = [...centreEdges, ...coEdges]

  return NextResponse.json({ nodes, edges, centre: name } satisfies GraphData)
}

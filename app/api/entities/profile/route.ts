import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
    const { searchParams } = new URL(req.url)
    const name = searchParams.get('name')
    const type = searchParams.get('type')

    if (!name || !type) {
      return NextResponse.json({ error: 'Missing name or type' }, { status: 400 })
    }

    // All occurrences of this entity across reports
    const occurrences = await prisma.reportEntity.findMany({
      where: { name, type },
      select: { reportId: true, context: true },
    })

    const reportIds = [...new Set(occurrences.map(o => o.reportId))]

    // Report metadata for source footprint
    const reports = await prisma.report.findMany({
      where: { id: { in: reportIds } },
      select: { id: true, title: true, area: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    // Context snippets (first occurrence per report)
    const contextByReport: Record<string, string | null> = {}
    for (const o of occurrences) {
      if (!contextByReport[o.reportId]) contextByReport[o.reportId] = o.context
    }

    const appearances = reports.map(r => ({
      reportId: r.id,
      reportTitle: r.title,
      area: r.area,
      context: contextByReport[r.id] ?? null,
      createdAt: r.createdAt.toISOString(),
    }))

    // Co-occurring entities in the same reports
    const coRaw = await prisma.reportEntity.findMany({
      where: {
        reportId: { in: reportIds },
        NOT: { name, type },
      },
      select: { name: true, type: true, reportId: true },
    })

    // Group co-entities by name+type, count unique report appearances
    const coMap: Record<string, { name: string; entityType: string; reportSet: Set<string> }> = {}
    for (const e of coRaw) {
      const key = `${e.type}::${e.name}`
      if (!coMap[key]) coMap[key] = { name: e.name, entityType: e.type, reportSet: new Set() }
      coMap[key].reportSet.add(e.reportId)
    }

    const coEntities = Object.values(coMap)
      .map(c => ({ name: c.name, entityType: c.entityType, sharedCount: c.reportSet.size }))
      .sort((a, b) => b.sharedCount - a.sharedCount)
      .slice(0, 10)

    return NextResponse.json({ appearances, coEntities })
  } catch (e) {
    console.error('Entity profile API error:', e)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

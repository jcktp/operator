import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const q = searchParams.get('q')?.trim().toLowerCase()

    const entities = await prisma.reportEntity.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(q ? { name: { contains: q } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })

    // Group by name to compute appearance counts
    const grouped: Record<string, {
      name: string
      type: string
      context: string | null
      reportIds: string[]
      count: number
    }> = {}

    for (const e of entities) {
      const key = `${e.type}::${e.name}`
      if (!grouped[key]) {
        grouped[key] = { name: e.name, type: e.type, context: e.context, reportIds: [], count: 0 }
      }
      if (!grouped[key].reportIds.includes(e.reportId)) {
        grouped[key].reportIds.push(e.reportId)
      }
      grouped[key].count++
    }

    // Fetch report titles for cross-linking
    const allReportIds = [...new Set(entities.map(e => e.reportId))]
    const reports = await prisma.report.findMany({
      where: { id: { in: allReportIds } },
      select: { id: true, title: true, area: true, createdAt: true },
    })
    const reportMap = Object.fromEntries(reports.map(r => [r.id, r]))

    const result = Object.values(grouped)
      .map(g => ({
        ...g,
        reports: g.reportIds.map(rid => reportMap[rid]).filter(Boolean),
      }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({ entities: result })
  } catch (e) {
    console.error('Entities API error:', e)
    return NextResponse.json({ error: 'Failed to fetch entities' }, { status: 500 })
  }
}

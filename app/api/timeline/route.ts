import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const reportIdsParam = searchParams.get('reportIds')
    if (!reportIdsParam) {
      return NextResponse.json({ error: 'reportIds parameter required' }, { status: 400 })
    }

    const reportIds = reportIdsParam.split(',').map(s => s.trim()).filter(Boolean)
    if (reportIds.length === 0) {
      return NextResponse.json({ events: [] })
    }

    const events = await prisma.timelineEvent.findMany({
      where: { reportId: { in: reportIds } },
      orderBy: [{ dateSortKey: 'asc' }, { createdAt: 'asc' }],
    })

    // Fetch report titles for attribution
    const reports = await prisma.report.findMany({
      where: { id: { in: reportIds } },
      select: { id: true, title: true },
    })
    const reportTitles = Object.fromEntries(reports.map(r => [r.id, r.title]))

    const result = events.map(e => ({
      id: e.id,
      reportId: e.reportId,
      reportTitle: reportTitles[e.reportId] ?? 'Unknown document',
      dateText: e.dateText,
      dateSortKey: e.dateSortKey,
      event: e.event,
    }))

    return NextResponse.json({ events: result })
  } catch (e) {
    console.error('Timeline API error:', e)
    return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 })
  }
}

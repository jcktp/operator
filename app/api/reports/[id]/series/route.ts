import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// POST /api/reports/[id]/series
// Body: { seriesId?: string, seriesName?: string, area: string }
// Creates a series if needed, then links this report (and sibling reports) to it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as { seriesId?: string; seriesName?: string; area: string; directReportId?: string }

  const report = await prisma.report.findUnique({ where: { id } })
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let seriesId = body.seriesId

  if (!seriesId) {
    // Create a new series
    const name = body.seriesName || `${report.area} Reports`
    const series = await prisma.reportSeries.create({
      data: { name, area: body.area },
    })
    seriesId = series.id

    // Link all existing reports in this area + directReportId to the series
    await prisma.report.updateMany({
      where: {
        area: body.area,
        ...(body.directReportId ? { directReportId: body.directReportId } : {}),
        seriesId: null,
      },
      data: { seriesId },
    })
  } else {
    // Just link this report to the existing series
    await prisma.report.update({ where: { id }, data: { seriesId } })
  }

  return NextResponse.json({ seriesId })
}

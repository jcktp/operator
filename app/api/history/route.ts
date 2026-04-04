import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { searchParams } = new URL(req.url)
  const area = searchParams.get('area')
  const directReportId = searchParams.get('directReportId')

  const reports = await prisma.report.findMany({
    where: {
      ...(area ? { area } : {}),
      ...(directReportId ? { directReportId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      area: true,
      fileName: true,
      fileType: true,
      summary: true,
      metrics: true,
      comparison: true,
      reportDate: true,
      createdAt: true,
      directReport: true,
    },
  })

  return NextResponse.json({ reports })
}

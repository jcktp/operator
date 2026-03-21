import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const area = searchParams.get('area')
  const directReportId = searchParams.get('directReportId')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  const reports = await prisma.report.findMany({
    where: {
      ...(area ? { area } : {}),
      ...(directReportId ? { directReportId } : {}),
    },
    include: { directReport: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ reports })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  await prisma.report.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

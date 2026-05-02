import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logAction } from '@/lib/audit'
import { requireAuth } from '@/lib/api-auth'
import { errorResponse } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req)
  if (authError) return authError
  try {
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
  } catch (e) {
    return errorResponse(e)
  }
}

export async function DELETE(req: NextRequest) {
  const authError = await requireAuth(req)
  if (authError) return authError
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const report = await prisma.report.findUnique({ where: { id }, select: { title: true, area: true } })
    await prisma.report.delete({ where: { id } })
    void logAction('report:delete', report ? `${report.title} (${report.area})` : id)
    return NextResponse.json({ success: true })
  } catch (e) {
    return errorResponse(e)
  }
}

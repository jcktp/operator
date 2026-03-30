import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logAction } from '@/lib/audit'
import { generateAreaBriefing } from '@/lib/ai'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const report = await prisma.report.findUnique({
    where: { id },
    include: { directReport: true },
  })
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ report })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const report = await prisma.report.findUnique({ where: { id }, select: { title: true, area: true } })
  await prisma.report.delete({ where: { id } })
  void logAction('report:delete', report ? `${report.title} (${report.area})` : id)

  if (report) {
    const area = report.area
    const remaining = await prisma.report.findMany({
      where: { area },
      select: { summary: true, metrics: true, insights: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    if (remaining.length === 0) {
      void prisma.areaBriefing.deleteMany({ where: { area } }).catch(() => {})
    } else {
      const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
      void generateAreaBriefing(area, modeRow?.value ?? 'executive', remaining).catch(() => {})
    }
  }

  return NextResponse.json({ success: true })
}

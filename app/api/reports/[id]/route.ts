import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logAction } from '@/lib/audit'

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
  return NextResponse.json({ success: true })
}

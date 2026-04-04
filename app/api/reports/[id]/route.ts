import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { logAction } from '@/lib/audit'
import { generateAreaBriefing } from '@/lib/ai'
import { deleteReportFile } from '@/lib/reports-folder'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params
  const report = await prisma.report.findUnique({
    where: { id },
    include: { directReport: true },
  })
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ report })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params
  const body = await req.json() as { userNotes?: string; storyName?: string }
  const data: Record<string, unknown> = {}
  if (body.userNotes !== undefined) data.userNotes = body.userNotes
  if (body.storyName !== undefined) data.storyName = body.storyName
  const report = await prisma.report.update({ where: { id }, data })
  return NextResponse.json({ report })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params
  const report = await prisma.report.findUnique({ where: { id }, select: { title: true, area: true, filePath: true, imagePath: true } })
  await prisma.report.delete({ where: { id } })
  // Remove upload job items for this report (frees rawContent storage), then prune empty jobs
  await prisma.uploadJobItem.deleteMany({ where: { reportId: id } })
  await prisma.uploadJob.deleteMany({ where: { items: { none: {} } } })
  // Delete files from disk
  if (report?.filePath) deleteReportFile(report.filePath)
  if (report?.imagePath) deleteReportFile(report.imagePath)
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

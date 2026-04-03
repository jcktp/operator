import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { deleteReportFile } from '@/lib/reports-folder'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAuth(req)
  if (authError) return authError
  const { id } = await params
  const body = await req.json() as {
    name?: string
    area?: string
    startDate?: string | null
    status?: string
    description?: string
  }
  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.area !== undefined ? { area: body.area } : {}),
      ...(body.startDate !== undefined ? { startDate: body.startDate ? new Date(body.startDate) : null } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
    },
  })
  return NextResponse.json({ project })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAuth(req)
  if (authError) return authError
  const { id } = await params

  // Fetch all reports in this project so we can clean up files
  const reports = await prisma.report.findMany({
    where: { projectId: id },
    select: { id: true, filePath: true, imagePath: true },
  })

  const reportIds = reports.map(r => r.id)

  if (reportIds.length > 0) {
    // Delete related job items, then prune empty jobs
    await prisma.uploadJobItem.deleteMany({ where: { reportId: { in: reportIds } } })
    await prisma.uploadJob.deleteMany({ where: { items: { none: {} } } })
    // Delete all reports (cascades to entities, timeline, redactions, etc.)
    await prisma.report.deleteMany({ where: { id: { in: reportIds } } })
    // Remove files from disk
    for (const r of reports) {
      if (r.filePath) deleteReportFile(r.filePath)
      if (r.imagePath) deleteReportFile(r.imagePath)
    }
  }

  // Clear current project setting if this was the active one
  const current = await prisma.setting.findUnique({ where: { key: 'current_project_id' } })
  if (current?.value === id) {
    await prisma.setting.delete({ where: { key: 'current_project_id' } })
  }

  await prisma.project.delete({ where: { id } })
  return Response.json({ ok: true })
}

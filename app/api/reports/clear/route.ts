import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logAction } from '@/lib/audit'
import { deleteReportFile } from '@/lib/reports-folder'
import { requireAuth } from '@/lib/api-auth'

export async function DELETE(req: NextRequest) {
  const authError = await requireAuth(req)
  if (authError) return authError
  const reports = await prisma.report.findMany({ select: { filePath: true, imagePath: true } })
  await prisma.report.deleteMany()
  await prisma.uploadJob.deleteMany()
  for (const r of reports) {
    if (r.filePath) deleteReportFile(r.filePath)
    if (r.imagePath) deleteReportFile(r.imagePath)
  }
  // Compact the database after a bulk delete
  await prisma.$executeRawUnsafe('VACUUM')
  void logAction('report:clear', `All ${reports.length} report${reports.length !== 1 ? 's' : ''} permanently deleted`)
  return NextResponse.json({ ok: true })
}

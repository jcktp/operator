/**
 * GET /api/upload-jobs
 * Returns active and recently completed upload jobs for the notification component.
 * Only returns jobs from the last 2 hours to keep it lightweight.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000)  // 2 hours ago

  const jobs = await prisma.uploadJob.findMany({
    where: {
      OR: [
        { status: { in: ['queued', 'processing'] } },
        { createdAt: { gte: cutoff }, status: { in: ['done', 'error'] } },
      ],
    },
    include: {
      items: {
        select: { id: true, title: true, area: true, status: true, reportId: true, error: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return NextResponse.json({ jobs })
}

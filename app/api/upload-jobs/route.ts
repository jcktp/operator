/**
 * GET /api/upload-jobs
 * Returns active and recently completed upload jobs for the notification component.
 * Also acts as a worker watchdog — if queued items exist but no worker is running,
 * kicks the worker so a crashed worker self-heals on the next notification poll.
 */
import { NextResponse , NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { kickWorker } from '@/lib/upload-queue'

export async function GET(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny
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
        select: { id: true, title: true, area: true, status: true, step: true, reportId: true, error: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // Watchdog: if any queued items exist, make sure the worker is running.
  // This self-heals a crashed worker without needing a server restart.
  const hasQueued = jobs.some(j => j.items.some(i => i.status === 'queued'))
  if (hasQueued) kickWorker()

  return NextResponse.json({ jobs })
}

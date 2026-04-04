import { NextResponse , NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params

  await prisma.uploadJobItem.updateMany({
    where: { jobId: id, status: { in: ['queued', 'processing'] } },
    data: { status: 'error', error: 'Cancelled by user' },
  })

  await prisma.uploadJob.update({
    where: { id },
    data: { status: 'error' },
  })

  return NextResponse.json({ ok: true })
}

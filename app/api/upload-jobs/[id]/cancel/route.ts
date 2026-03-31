import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

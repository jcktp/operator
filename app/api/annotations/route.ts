import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const reportId = req.nextUrl.searchParams.get('reportId')
  if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

  const annotations = await prisma.annotation.findMany({
    where: { reportId },
    orderBy: { startOffset: 'asc' },
  })
  return NextResponse.json({ annotations })
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const body = await req.json() as {
    reportId: string
    startOffset: number
    endOffset: number
    text: string
    note?: string
    color?: string
  }

  if (!body.reportId || body.startOffset == null || body.endOffset == null || !body.text) {
    return NextResponse.json({ error: 'reportId, startOffset, endOffset, text required' }, { status: 400 })
  }

  const annotation = await prisma.annotation.create({
    data: {
      reportId: body.reportId,
      startOffset: body.startOffset,
      endOffset: body.endOffset,
      text: body.text,
      note: body.note ?? null,
      color: body.color ?? 'yellow',
    },
  })

  return NextResponse.json({ annotation }, { status: 201 })
}

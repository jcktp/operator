import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const request = await prisma.reportRequest.findUnique({
    where: { token },
    include: { directReport: true },
  })

  if (!request) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (request.expiresAt && request.expiresAt < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 })
  }

  if (request.status === 'submitted') {
    return NextResponse.json({ error: 'submitted' }, { status: 410 })
  }

  return NextResponse.json({ request })
}

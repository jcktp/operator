import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
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

    const [directs, modeRow] = await Promise.all([
      prisma.directReport.findMany({
        select: { id: true, name: true, title: true },
        orderBy: { name: 'asc' },
      }),
      prisma.setting.findUnique({ where: { key: 'app_mode' } }),
    ])

    return NextResponse.json({ request, directs, mode: modeRow?.value ?? null })
  } catch (e) {
    console.error('Report request lookup error:', e)
    return NextResponse.json({ error: 'server_error', detail: String(e) }, { status: 500 })
  }
}

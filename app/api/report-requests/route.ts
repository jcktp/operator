import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { randomBytes } from 'crypto'

export async function GET(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const requests = await prisma.reportRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: { directReport: true },
  })
  return NextResponse.json({ requests })
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
    const { title, area, message, directReportId, projectId, expiresInDays } = await req.json()

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    if (!area)  return NextResponse.json({ error: 'Area is required' }, { status: 400 })

    const token = randomBytes(12).toString('hex') // 24-char hex token

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null

    const request = await prisma.reportRequest.create({
      data: {
        token,
        title,
        area,
        message: message || null,
        directReportId: directReportId || null,
        projectId: projectId || null,
        expiresAt,
      },
      include: { directReport: true },
    })

    return NextResponse.json({ request })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

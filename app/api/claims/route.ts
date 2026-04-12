import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { errorResponse } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  try {
    const searchParams = req.nextUrl.searchParams
    const status = searchParams.get('status')
    const reportId = searchParams.get('reportId')
    const projectId = searchParams.get('projectId')
    const take = Math.min(Number(searchParams.get('limit')) || 500, 2000)
    const skip = Number(searchParams.get('offset')) || 0

    const claims = await prisma.claim.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(reportId ? { reportId } : {}),
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { report: { select: { id: true, title: true } } },
      take,
      skip,
    })
    return NextResponse.json({ claims })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
    const body = await req.json() as {
      text: string
      source?: string
      sourceType?: string
      status?: string
      notes?: string
      reportId?: string
      projectId?: string
    }
    if (!body.text?.trim()) {
      return NextResponse.json({ error: 'text required' }, { status: 400 })
    }
    const claim = await prisma.claim.create({
      data: {
        id: crypto.randomUUID(),
        text: body.text.trim(),
        source: body.source?.trim() ?? null,
        sourceType: body.sourceType ?? 'document',
        status: body.status ?? 'unverified',
        notes: body.notes?.trim() ?? null,
        reportId: body.reportId ?? null,
        projectId: body.projectId ?? null,
      },
      include: { report: { select: { id: true, title: true } } },
    })
    return NextResponse.json({ claim }, { status: 201 })
  } catch (e) {
    return errorResponse(e)
  }
}

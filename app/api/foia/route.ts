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
    const projectId = searchParams.get('projectId')
    const take = Math.min(Number(searchParams.get('limit')) || 500, 2000)
    const skip = Number(searchParams.get('offset')) || 0

    const requests = await prisma.foiaRequest.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    })
    return NextResponse.json({ requests })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
    const body = await req.json() as {
      agency: string
      subject: string
      description?: string
      status?: string
      filedAt?: string
      dueAt?: string
      trackingNum?: string
      notes?: string
      projectId?: string
    }
    if (!body.agency?.trim() || !body.subject?.trim()) {
      return NextResponse.json({ error: 'agency and subject required' }, { status: 400 })
    }
    const request = await prisma.foiaRequest.create({
      data: {
        id: crypto.randomUUID(),
        agency: body.agency.trim(),
        subject: body.subject.trim(),
        description: body.description?.trim() ?? null,
        status: body.status ?? 'draft',
        filedAt: body.filedAt ? new Date(body.filedAt) : null,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        trackingNum: body.trackingNum?.trim() ?? null,
        notes: body.notes?.trim() ?? null,
        projectId: body.projectId ?? null,
      },
    })
    return NextResponse.json({ request }, { status: 201 })
  } catch (e) {
    return errorResponse(e)
  }
}

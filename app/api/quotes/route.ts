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
    const sourceType = searchParams.get('sourceType')
    const projectId  = searchParams.get('projectId')
    const reportId   = searchParams.get('reportId')
    const take = Math.min(Number(searchParams.get('limit')) || 500, 2000)
    const skip = Number(searchParams.get('offset')) || 0

    const quotes = await prisma.quote.findMany({
      where: {
        ...(sourceType ? { sourceType } : {}),
        ...(projectId  ? { projectId }  : {}),
        ...(reportId   ? { reportId }   : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    })
    return NextResponse.json({ quotes })
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
      speaker?: string
      context?: string
      sourceType?: string
      tags?: string[]
      reportId?: string
      projectId?: string
    }
    if (!body.text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

    const quote = await prisma.quote.create({
      data: {
        id:         crypto.randomUUID(),
        text:       body.text.trim(),
        speaker:    body.speaker?.trim()  ?? null,
        context:    body.context?.trim()  ?? null,
        sourceType: body.sourceType       ?? 'interview',
        tags:       JSON.stringify(body.tags ?? []),
        reportId:   body.reportId         ?? null,
        projectId:  body.projectId        ?? null,
      },
    })
    return NextResponse.json({ quote: { ...quote, tags: JSON.parse(quote.tags) } }, { status: 201 })
  } catch (e) {
    return errorResponse(e)
  }
}

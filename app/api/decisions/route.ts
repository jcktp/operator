import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { searchParams } = req.nextUrl
  const status    = searchParams.get('status')
  const projectId = searchParams.get('projectId')

  const decisions = await prisma.decision.findMany({
    where: {
      ...(status    ? { status }    : {}),
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ decisions })
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const body = await req.json() as {
    title: string
    context?: string
    rationale?: string
    outcome?: string
    status?: string
    madeBy?: string
    madeAt?: string
    notes?: string
    projectId?: string
  }

  if (!body.title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const decision = await prisma.decision.create({
    data: {
      id:        crypto.randomUUID(),
      title:     body.title.trim(),
      context:   body.context?.trim()   ?? null,
      rationale: body.rationale?.trim() ?? null,
      outcome:   body.outcome?.trim()   ?? null,
      status:    body.status            ?? 'pending',
      madeBy:    body.madeBy?.trim()    ?? null,
      madeAt:    body.madeAt ? new Date(body.madeAt) : null,
      notes:     body.notes?.trim()     ?? null,
      projectId: body.projectId         ?? null,
    },
  })

  return NextResponse.json({ decision }, { status: 201 })
}

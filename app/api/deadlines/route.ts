import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { searchParams } = req.nextUrl
  const status    = searchParams.get('status')
  const kind      = searchParams.get('kind')
  const projectId = searchParams.get('projectId')

  const deadlines = await prisma.deadline.findMany({
    where: {
      ...(status    ? { status }    : {}),
      ...(kind      ? { kind }      : {}),
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { dueAt: 'asc' },
  })

  return NextResponse.json({ deadlines })
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const body = await req.json() as {
    title: string
    description?: string
    kind?: string
    dueAt: string
    priority?: string
    status?: string
    context?: string
    notes?: string
    projectId?: string
  }

  if (!body.title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })
  if (!body.dueAt)         return NextResponse.json({ error: 'dueAt required' }, { status: 400 })

  const deadline = await prisma.deadline.create({
    data: {
      id:          crypto.randomUUID(),
      title:       body.title.trim(),
      description: body.description?.trim() ?? null,
      kind:        body.kind      ?? 'other',
      dueAt:       new Date(body.dueAt),
      priority:    body.priority  ?? 'medium',
      status:      body.status    ?? 'upcoming',
      context:     body.context?.trim()     ?? null,
      notes:       body.notes?.trim()       ?? null,
      projectId:   body.projectId           ?? null,
    },
  })

  return NextResponse.json({ deadline }, { status: 201 })
}

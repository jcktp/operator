import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { searchParams } = req.nextUrl
  const kind      = searchParams.get('kind')
  const status    = searchParams.get('status')
  const projectId = searchParams.get('projectId')

  const items = await prisma.actionItem.findMany({
    where: {
      ...(kind      ? { kind }      : {}),
      ...(status    ? { status }    : {}),
      ...(projectId ? { projectId } : {}),
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const body = await req.json() as {
    title: string
    description?: string
    kind?: string
    assignee?: string
    dueAt?: string
    priority?: string
    status?: string
    source?: string
    notes?: string
    projectId?: string
  }

  if (!body.title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const item = await prisma.actionItem.create({
    data: {
      id:          crypto.randomUUID(),
      title:       body.title.trim(),
      description: body.description?.trim() ?? null,
      kind:        body.kind      ?? 'action',
      assignee:    body.assignee?.trim() ?? null,
      dueAt:       body.dueAt ? new Date(body.dueAt) : null,
      priority:    body.priority ?? 'medium',
      status:      body.status   ?? 'open',
      source:      body.source?.trim()   ?? null,
      notes:       body.notes?.trim()    ?? null,
      projectId:   body.projectId        ?? null,
    },
  })

  return NextResponse.json({ item }, { status: 201 })
}

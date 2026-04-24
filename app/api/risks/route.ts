import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { logAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { searchParams } = req.nextUrl
  const status    = searchParams.get('status')
  const projectId = searchParams.get('projectId')

  const risks = await prisma.risk.findMany({
    where: {
      ...(status    ? { status }    : {}),
      ...(projectId ? { projectId } : {}),
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ risks })
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const body = await req.json() as {
    title: string
    description?: string
    category?: string
    probability?: string
    impact?: string
    owner?: string
    status?: string
    notes?: string
    dueAt?: string
    projectId?: string
  }

  if (!body.title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const risk = await prisma.risk.create({
    data: {
      id:          crypto.randomUUID(),
      title:       body.title.trim(),
      description: body.description?.trim() ?? null,
      category:    body.category    ?? 'operational',
      probability: body.probability ?? 'medium',
      impact:      body.impact      ?? 'medium',
      owner:       body.owner?.trim()  ?? null,
      status:      body.status         ?? 'open',
      notes:       body.notes?.trim()  ?? null,
      dueAt:       body.dueAt ? new Date(body.dueAt) : null,
      projectId:   body.projectId ?? null,
    },
  })

  void logAction('risk.created', risk.title)
  return NextResponse.json({ risk }, { status: 201 })
}

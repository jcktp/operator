import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { searchParams } = req.nextUrl
  const department = searchParams.get('department')
  const status     = searchParams.get('status')
  const projectId  = searchParams.get('projectId')

  const entries = await prisma.headcountEntry.findMany({
    where: {
      ...(department ? { department } : {}),
      ...(status     ? { status }     : {}),
      ...(projectId  ? { projectId }  : {}),
    },
    orderBy: [{ department: 'asc' }, { role: 'asc' }],
  })

  return NextResponse.json({ entries })
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const body = await req.json() as {
    role: string
    department: string
    currentCount?: number
    targetCount?: number
    openPositions?: number
    attritionRate?: number
    status?: string
    targetDate?: string
    hiringManager?: string
    notes?: string
    projectId?: string
  }

  if (!body.role?.trim())       return NextResponse.json({ error: 'role required' }, { status: 400 })
  if (!body.department?.trim()) return NextResponse.json({ error: 'department required' }, { status: 400 })

  const entry = await prisma.headcountEntry.create({
    data: {
      id:            crypto.randomUUID(),
      role:          body.role.trim(),
      department:    body.department.trim(),
      currentCount:  body.currentCount  ?? 0,
      targetCount:   body.targetCount   ?? 0,
      openPositions: body.openPositions ?? 0,
      attritionRate: body.attritionRate ?? 0,
      status:        body.status        ?? 'planning',
      targetDate:    body.targetDate ? new Date(body.targetDate) : null,
      hiringManager: body.hiringManager?.trim() ?? null,
      notes:         body.notes?.trim()         ?? null,
      projectId:     body.projectId             ?? null,
    },
  })

  return NextResponse.json({ entry }, { status: 201 })
}

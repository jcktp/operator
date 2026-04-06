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

  const themes = await prisma.theme.findMany({
    where: {
      ...(status    ? { status }    : {}),
      ...(projectId ? { projectId } : {}),
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ themes })
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const body = await req.json() as {
    title: string
    description?: string
    status?: string
    notes?: string
    projectId?: string
  }

  if (!body.title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const theme = await prisma.theme.create({
    data: {
      id:          crypto.randomUUID(),
      title:       body.title.trim(),
      description: body.description?.trim() ?? null,
      status:      body.status    ?? 'candidate',
      notes:       body.notes?.trim()       ?? null,
      projectId:   body.projectId           ?? null,
    },
  })

  return NextResponse.json({ theme }, { status: 201 })
}

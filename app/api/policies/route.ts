import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { searchParams } = req.nextUrl
  const status   = searchParams.get('status')
  const category = searchParams.get('category')

  const policies = await prisma.policyRecord.findMany({
    where: {
      ...(status   ? { status }   : {}),
      ...(category ? { category } : {}),
    },
    orderBy: [{ status: 'asc' }, { title: 'asc' }],
  })

  return NextResponse.json({ policies })
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const body = await req.json() as {
    title: string
    description?: string
    owner?: string
    category?: string
    status?: string
    lastReviewedAt?: string
    nextReviewAt?: string
    notes?: string
  }

  if (!body.title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const policy = await prisma.policyRecord.create({
    data: {
      id:             crypto.randomUUID(),
      title:          body.title.trim(),
      description:    body.description?.trim()    ?? null,
      owner:          body.owner?.trim()           ?? null,
      category:       body.category                ?? 'general',
      status:         body.status                  ?? 'active',
      lastReviewedAt: body.lastReviewedAt ? new Date(body.lastReviewedAt) : null,
      nextReviewAt:   body.nextReviewAt   ? new Date(body.nextReviewAt)   : null,
      notes:          body.notes?.trim()           ?? null,
    },
  })

  return NextResponse.json({ policy }, { status: 201 })
}

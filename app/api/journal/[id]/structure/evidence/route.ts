import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

// GET /api/journal/[id]/structure/evidence — list evidence for entry
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params
  const items = await prisma.evidenceItem.findMany({
    where: { entryId: id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ items })
}

// POST /api/journal/[id]/structure/evidence — add an evidence item
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params
  const body = await req.json() as {
    url: string
    title: string
    accessedAt?: string
    archiveUrl?: string
    notes?: string
  }
  if (!body.url?.trim() || !body.title?.trim()) {
    return NextResponse.json({ error: 'url and title are required' }, { status: 400 })
  }
  const item = await prisma.evidenceItem.create({
    data: {
      entryId: id,
      url: body.url.trim(),
      title: body.title.trim(),
      accessedAt: body.accessedAt ? new Date(body.accessedAt) : null,
      archiveUrl: body.archiveUrl?.trim() ?? null,
      notes: body.notes?.trim() ?? null,
    },
  })
  return NextResponse.json({ item }, { status: 201 })
}

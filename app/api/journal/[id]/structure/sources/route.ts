import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

// GET /api/journal/[id]/structure/sources
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params
  const sources = await prisma.storySource.findMany({
    where: { entryId: id },
    include: { directReport: { select: { id: true, name: true, title: true, area: true, updatedAt: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ sources })
}

// POST /api/journal/[id]/structure/sources — add or update a direct report as a source
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params
  const { directReportId, tags, notes } = await req.json() as {
    directReportId: string
    tags?: string[]
    notes?: string
  }
  const source = await prisma.storySource.upsert({
    where: { entryId_directReportId: { entryId: id, directReportId } },
    create: {
      entryId: id,
      directReportId,
      tags: JSON.stringify(tags ?? []),
      notes: notes ?? null,
    },
    update: {
      tags: JSON.stringify(tags ?? []),
      notes: notes ?? null,
    },
    include: { directReport: { select: { id: true, name: true, title: true, area: true, updatedAt: true } } },
  })
  return NextResponse.json({ source })
}

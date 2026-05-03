import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

// GET /api/journal/[id]/structure — read structure (or null if entry has none)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params
  const structure = await prisma.entryStructure.findUnique({ where: { entryId: id } })
  return NextResponse.json({ structure })
}

// POST /api/journal/[id]/structure — promote: create the structure row
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params

  const entry = await prisma.journalEntry.findUnique({ where: { id } })
  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

  const existing = await prisma.entryStructure.findUnique({ where: { entryId: id } })
  if (existing) return NextResponse.json({ structure: existing })

  const body = await req.json().catch(() => ({})) as {
    description?: string
    status?: string
    reportIds?: string[]
  }

  const structure = await prisma.entryStructure.create({
    data: {
      entryId: id,
      status: body.status ?? 'draft',
      description: body.description ?? null,
      reportIds: JSON.stringify(body.reportIds ?? []),
    },
  })
  return NextResponse.json({ structure }, { status: 201 })
}

// PATCH /api/journal/[id]/structure — update fields
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params
  const body = await req.json() as {
    status?: string
    description?: string | null
    reportIds?: string[]
    events?: string
    claimStatuses?: string
  }
  const data: Record<string, unknown> = {}
  if (body.status !== undefined) data.status = body.status
  if (body.description !== undefined) data.description = body.description
  if (body.reportIds !== undefined) data.reportIds = JSON.stringify(body.reportIds)
  if (body.events !== undefined) data.events = body.events
  if (body.claimStatuses !== undefined) data.claimStatuses = body.claimStatuses

  const structure = await prisma.entryStructure.update({
    where: { entryId: id },
    data,
  })
  return NextResponse.json({ structure })
}

// DELETE /api/journal/[id]/structure — demote: drop the structure row + child evidence/sources
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params

  // Hard-delete child rows that were attached via entryId.
  await prisma.evidenceItem.deleteMany({ where: { entryId: id } })
  await prisma.storySource.deleteMany({ where: { entryId: id } })
  await prisma.entryStructure.deleteMany({ where: { entryId: id } })
  return NextResponse.json({ ok: true })
}

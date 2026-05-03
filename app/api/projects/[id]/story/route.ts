import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

// GET /api/projects/[id]/story — read story fields
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true, name: true,
      narrative: true, storyStatus: true, storyDescription: true,
      storyReportIds: true, storyEvents: true, storyClaimStatuses: true, storyShared: true,
      updatedAt: true,
    },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ project })
}

// PATCH /api/projects/[id]/story — update any story field
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params
  const body = await req.json() as {
    narrative?: string
    storyStatus?: string
    storyDescription?: string | null
    storyReportIds?: string[]
    storyEvents?: string
    storyClaimStatuses?: string
    storyShared?: boolean
    name?: string
  }

  const data: Record<string, unknown> = {}
  if (body.narrative          !== undefined) data.narrative          = body.narrative
  if (body.storyStatus        !== undefined) data.storyStatus        = body.storyStatus
  if (body.storyDescription   !== undefined) data.storyDescription   = body.storyDescription
  if (body.storyReportIds     !== undefined) data.storyReportIds     = JSON.stringify(body.storyReportIds)
  if (body.storyEvents        !== undefined) data.storyEvents        = body.storyEvents
  if (body.storyClaimStatuses !== undefined) data.storyClaimStatuses = body.storyClaimStatuses
  if (body.storyShared        !== undefined) data.storyShared        = body.storyShared
  if (body.name               !== undefined) data.name               = body.name

  const project = await prisma.project.update({ where: { id }, data })
  return NextResponse.json({ project })
}

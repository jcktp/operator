import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

/**
 * POST /api/stories — create a new story (= Project with story fields pre-populated).
 * A story IS a project. One row. No separate JournalEntry created.
 *
 * Body: { title?, description?, reuseProjectId?, status?, reportIds?, shared? }
 */
export async function POST(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const body = await req.json().catch(() => ({})) as {
    title?: string
    description?: string
    reuseProjectId?: string | null
    status?: string
    reportIds?: string[]
    shared?: boolean
  }

  const title = (body.title ?? '').trim() || 'Untitled story'

  let project
  if (body.reuseProjectId) {
    project = await prisma.project.update({
      where: { id: body.reuseProjectId },
      data: {
        ...(body.status      !== undefined && { storyStatus: body.status }),
        ...(body.description !== undefined && { storyDescription: body.description.trim() || null }),
        ...(body.reportIds   !== undefined && { storyReportIds: JSON.stringify(body.reportIds) }),
        ...(body.shared      !== undefined && { storyShared: body.shared }),
      },
    })
  } else {
    project = await prisma.project.create({
      data: {
        name:             title,
        storyStatus:      body.status      ?? 'draft',
        storyDescription: body.description?.trim() || null,
        storyReportIds:   body.reportIds   ? JSON.stringify(body.reportIds) : '[]',
        storyShared:      body.shared      ?? false,
      },
    })
    // Make this new story the active project
    await prisma.setting.upsert({
      where:  { key: 'current_project_id' },
      create: { key: 'current_project_id', value: project.id },
      update: { value: project.id },
    })
  }

  return NextResponse.json({ project }, { status: 201 })
}

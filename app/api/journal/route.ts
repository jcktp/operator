import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const entries = await prisma.journalEntry.findMany({
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json({ entries })
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
    const { id, title, folder, content, projectId } = await req.json()

    if (id) {
      // Update existing
      const update: Record<string, unknown> = {}
      if (title !== undefined) update.title = title
      if (folder !== undefined) update.folder = folder
      if (content !== undefined) update.content = content
      if (projectId !== undefined) update.projectId = projectId ?? null
      const entry = await prisma.journalEntry.update({
        where: { id },
        data: update,
      })
      return NextResponse.json({ entry })
    }

    // Create new
    const entry = await prisma.journalEntry.create({
      data: {
        title: title ?? 'Untitled',
        folder: folder ?? 'General',
        content: content ?? '',
        weekStart: null,
        projectId: projectId ?? null,
      },
    })
    return NextResponse.json({ entry })
  } catch (e) {
    console.error('[journal POST]', e)
    return NextResponse.json({ error: 'Failed to save entry' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await req.json()
  await prisma.journalEntry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const entries = await prisma.journalEntry.findMany({
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json({ entries })
}

export async function POST(req: NextRequest) {
  try {
    const { id, title, folder, content } = await req.json()

    if (id) {
      // Update existing
      const update: Record<string, string> = {}
      if (title !== undefined) update.title = title
      if (folder !== undefined) update.folder = folder
      if (content !== undefined) update.content = content
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
      },
    })
    return NextResponse.json({ entry })
  } catch (e) {
    console.error('[journal POST]', e)
    return NextResponse.json({ error: 'Failed to save entry' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.journalEntry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

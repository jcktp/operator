import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// POST /api/pulse/items/[id] — save item to journal (optional { folder } body)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const item = await prisma.pulseItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let folder = 'Pulse'
  try {
    const body = await req.json()
    if (typeof body?.folder === 'string' && body.folder.trim()) {
      folder = body.folder.trim()
    }
  } catch { /* no body is fine */ }

  const content = [
    item.summary ?? '',
    item.url ? `\n\n[Source](${item.url})` : '',
  ].join('')

  await prisma.journalEntry.create({
    data: {
      title: item.title,
      folder,
      content,
    },
  })

  await prisma.pulseItem.update({ where: { id }, data: { savedToJournal: true } })

  return NextResponse.json({ ok: true })
}

// DELETE /api/pulse/items/[id] — unsave item (remove from journal + reset flag)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const item = await prisma.pulseItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Remove matching journal entry in the Pulse folder
  await prisma.journalEntry.deleteMany({
    where: { title: item.title, folder: 'Pulse' },
  })

  await prisma.pulseItem.update({ where: { id }, data: { savedToJournal: false } })

  return NextResponse.json({ ok: true })
}

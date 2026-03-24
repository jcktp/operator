import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// POST /api/pulse/items/[id] — save item to journal
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const item = await prisma.pulseItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const content = [
    item.summary ?? '',
    item.url ? `\n\n[Source](${item.url})` : '',
  ].join('')

  await prisma.journalEntry.create({
    data: {
      title: item.title,
      folder: 'Pulse',
      content,
    },
  })

  await prisma.pulseItem.update({ where: { id }, data: { savedToJournal: true } })

  return NextResponse.json({ ok: true })
}

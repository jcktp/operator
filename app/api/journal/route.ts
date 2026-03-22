import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const entries = await prisma.journalEntry.findMany({
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json({ entries })
}

export async function POST(req: NextRequest) {
  const { id, title, folder, content } = await req.json()

  if (id) {
    // Update existing
    const entry = await prisma.journalEntry.update({
      where: { id },
      data: { title, folder, content },
    })
    return NextResponse.json({ entry })
  }

  // Create new
  const entry = await prisma.journalEntry.create({
    data: {
      title: title ?? 'Untitled',
      folder: folder ?? 'General',
      content: content ?? '',
    },
  })
  return NextResponse.json({ entry })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.journalEntry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

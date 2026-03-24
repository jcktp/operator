import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchFeedItems } from '@/lib/pulse'

// DELETE /api/pulse/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.pulseFeed.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

// POST /api/pulse/[id] — refresh feed
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const feed = await prisma.pulseFeed.findUnique({ where: { id } })
  if (!feed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const items = await fetchFeedItems(feed.url, feed.type)
  let added = 0
  for (const item of items) {
    try {
      await prisma.pulseItem.create({ data: { ...item, feedId: id } })
      added++
    } catch {
      // skip duplicates (no unique constraint but URL+feedId combo avoids exact dups)
    }
  }
  await prisma.pulseFeed.update({ where: { id }, data: { lastFetched: new Date() } })

  return NextResponse.json({ added })
}

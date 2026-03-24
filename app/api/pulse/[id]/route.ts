import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchFeedItems } from '@/lib/pulse'

// PUT /api/pulse/[id] — edit feed name / url / type
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as { name?: string; url?: string; type?: string; enabled?: boolean }
  const feed = await prisma.pulseFeed.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.url !== undefined ? { url: body.url } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    },
    include: { items: { orderBy: { publishedAt: 'desc' }, take: 50 } },
  })
  return NextResponse.json({ feed })
}

// DELETE /api/pulse/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.pulseFeed.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

// POST /api/pulse/[id] — refresh feed, or clear items with { action: 'clear' }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const body = await req.json().catch(() => ({})) as { action?: string }
  if (body.action === 'clear') {
    await prisma.pulseItem.deleteMany({ where: { feedId: id } })
    return NextResponse.json({ ok: true })
  }

  const feed = await prisma.pulseFeed.findUnique({ where: { id } })
  if (!feed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let items
  try {
    items = await fetchFeedItems(feed.url, feed.type)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }

  let added = 0
  for (const item of items) {
    try {
      await prisma.pulseItem.create({ data: { ...item, feedId: id } })
      added++
    } catch {
      // skip exact duplicates
    }
  }
  await prisma.pulseFeed.update({ where: { id }, data: { lastFetched: new Date() } })

  return NextResponse.json({ added })
}

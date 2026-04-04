import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { fetchFeedItems } from '@/lib/pulse'
import { loadAiSettings } from '@/lib/settings'

// PUT /api/pulse/[id] — edit feed name / url / type
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny
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
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params
  await prisma.pulseFeed.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

// POST /api/pulse/[id] — refresh feed, or clear items with { action: 'clear' }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params

  const body = await req.json().catch(() => ({})) as { action?: string }
  if (body.action === 'clear') {
    await prisma.pulseItem.deleteMany({ where: { feedId: id } })
    return NextResponse.json({ ok: true })
  }

  await loadAiSettings()

  if (process.env.AIR_GAP_MODE === 'true') {
    return NextResponse.json({ error: 'Air-gap mode is enabled — external feeds are blocked.' }, { status: 403 })
  }

  const feed = await prisma.pulseFeed.findUnique({ where: { id } })
  if (!feed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let items
  try {
    items = await fetchFeedItems(feed.url, feed.type)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }

  // Load existing item keys for this feed so we can skip duplicates
  const existing = await prisma.pulseItem.findMany({
    where: { feedId: id },
    select: { url: true, title: true },
  })
  const existingUrls = new Set(existing.map(e => e.url).filter(Boolean) as string[])
  const existingTitles = new Set(existing.filter(e => !e.url).map(e => e.title))

  let added = 0
  for (const item of items) {
    const isDupe = item.url
      ? existingUrls.has(item.url)
      : existingTitles.has(item.title)
    if (isDupe) continue
    await prisma.pulseItem.create({ data: { ...item, feedId: id } })
    // Track so we don't re-insert within the same batch
    if (item.url) existingUrls.add(item.url)
    else existingTitles.add(item.title)
    added++
  }
  await prisma.pulseFeed.update({ where: { id }, data: { lastFetched: new Date() } })

  return NextResponse.json({ added })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchFeedItems } from '@/lib/pulse'
import { loadAiSettings } from '@/lib/settings'

// GET /api/pulse — list all feeds with latest items
export async function GET() {
  const feeds = await prisma.pulseFeed.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      items: {
        orderBy: { publishedAt: 'desc' },
        take: 50,
      },
    },
  })
  return NextResponse.json({ feeds })
}

// POST /api/pulse — create feed + fetch initial items
export async function POST(req: NextRequest) {
  await loadAiSettings()
  if (process.env.AIR_GAP_MODE === 'true') {
    return NextResponse.json({ error: 'Air-gap mode is enabled — external feeds are blocked.' }, { status: 403 })
  }
  const body = await req.json() as { name: string; url: string; type: string }
  const { name, url, type } = body
  if (!name || !url || !type) {
    return NextResponse.json({ error: 'name, url and type are required' }, { status: 400 })
  }

  const feed = await prisma.pulseFeed.create({ data: { name, url, type } })

  // Fetch items immediately
  try {
    const items = await fetchFeedItems(url, type)
    if (items.length > 0) {
      const seenUrls = new Set<string>()
      const seenTitles = new Set<string>()
      for (const item of items) {
        const isDupe = item.url ? seenUrls.has(item.url) : seenTitles.has(item.title)
        if (isDupe) continue
        await prisma.pulseItem.create({ data: { ...item, feedId: feed.id } })
        if (item.url) seenUrls.add(item.url)
        else seenTitles.add(item.title)
      }
      await prisma.pulseFeed.update({ where: { id: feed.id }, data: { lastFetched: new Date() } })
    }
  } catch (e) {
    console.warn('Initial feed fetch failed:', e)
  }

  const full = await prisma.pulseFeed.findUnique({
    where: { id: feed.id },
    include: { items: { orderBy: { publishedAt: 'desc' }, take: 50 } },
  })
  return NextResponse.json({ feed: full })
}

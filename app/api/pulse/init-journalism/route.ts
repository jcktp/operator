import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const JOURNALISM_DEFAULTS = [
  { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/topNews', type: 'rss' },
  { name: 'AP News', url: 'https://feeds.apnews.com/rss/apf-topnews', type: 'rss' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss', type: 'rss' },
  { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml', type: 'rss' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', type: 'rss' },
  { name: 'ProPublica', url: 'https://feeds.propublica.org/propublica/main', type: 'rss' },
]

// POST — idempotent: only creates defaults if no feeds exist yet
export async function POST() {
  const count = await prisma.pulseFeed.count()
  if (count > 0) {
    return NextResponse.json({ ok: true, created: 0 })
  }

  await prisma.pulseFeed.createMany({
    data: JOURNALISM_DEFAULTS.map(d => ({
      name: d.name,
      url: d.url,
      type: d.type,
      enabled: true,
    })),
  })

  return NextResponse.json({ ok: true, created: JOURNALISM_DEFAULTS.length })
}

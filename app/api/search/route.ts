import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseJsonSafe } from '@/lib/utils'

function snippet(text: string, q: string, maxLen = 120): string {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(q.toLowerCase())
  if (idx === -1) return text.slice(0, maxLen)
  const start = Math.max(0, idx - 30)
  const end = Math.min(text.length, idx + q.length + 90)
  const s = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
  return s.slice(0, maxLen + 4)
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ reports: [], journal: [] })

  const qLower = q.toLowerCase()

  // Fetch reports matching title/summary via DB, plus all for JSON scanning
  const [dbMatches, allReports, journalEntries] = await Promise.all([
    prisma.report.findMany({
      where: { OR: [{ title: { contains: q } }, { summary: { contains: q } }] },
      include: { directReport: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      include: { directReport: true },
      take: 100, // cap for JSON scanning
    }),
    prisma.journalEntry.findMany({
      where: { OR: [{ title: { contains: q } }, { content: { contains: q } }] },
      orderBy: { updatedAt: 'desc' },
      take: 4,
    }),
  ])

  // Also scan JSON fields for matches
  const jsonMatches = allReports.filter(r => {
    const insights = parseJsonSafe<Array<{ text: string }>>(r.insights, [])
    const metrics  = parseJsonSafe<Array<{ label: string; value: string }>>(r.metrics, [])
    const questions = parseJsonSafe<Array<{ text: string }>>(r.questions, [])
    return (
      insights.some(i => i.text?.toLowerCase().includes(qLower)) ||
      metrics.some(m => m.label?.toLowerCase().includes(qLower) || m.value?.toLowerCase().includes(qLower)) ||
      questions.some(qq => qq.text?.toLowerCase().includes(qLower)) ||
      r.directReport?.name?.toLowerCase().includes(qLower)
    )
  })

  // Merge, deduplicate, take top 8
  const seen = new Set<string>()
  const merged = [...dbMatches, ...jsonMatches].filter(r => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  }).slice(0, 8)

  const reports = merged.map(r => ({
    id: r.id,
    title: r.title,
    area: r.area,
    directReport: r.directReport ? { name: r.directReport.name } : null,
    snippet: snippet(r.summary ?? r.title, q),
  }))

  const journal = journalEntries.map(e => ({
    id: e.id,
    title: e.title,
    folder: e.folder ?? '',
    snippet: snippet(e.content ?? e.title, q),
  }))

  return NextResponse.json({ reports, journal })
}

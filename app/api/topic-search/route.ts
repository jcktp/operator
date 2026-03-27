import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseJsonSafe } from '@/lib/utils'

interface TopicHit {
  reportId: string
  reportTitle: string
  area: string
  directName?: string
  date: string
  matches: Array<{ field: 'summary' | 'metric' | 'insight' | 'question'; text: string }>
}

function highlight(text: string, q: string, maxLen = 160): string {
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return text.slice(0, maxLen)
  const start = Math.max(0, idx - 40)
  const end = Math.min(text.length, idx + q.length + 120)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

export async function GET(req: NextRequest) {
  try {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ hits: [] })

  const qLower = q.toLowerCase()

  const reports = await prisma.report.findMany({
    orderBy: { createdAt: 'desc' },
    include: { directReport: true },
  })

  const hits: TopicHit[] = []

  for (const r of reports) {
    const matches: TopicHit['matches'] = []

    // Summary
    if (r.summary?.toLowerCase().includes(qLower) || r.title.toLowerCase().includes(qLower)) {
      matches.push({ field: 'summary', text: highlight(r.summary ?? r.title, q) })
    }

    // Metrics
    const metrics = parseJsonSafe<Array<{ label: string; value: string }>>(r.metrics, [])
    for (const m of metrics) {
      if (m.label?.toLowerCase().includes(qLower) || m.value?.toLowerCase().includes(qLower)) {
        matches.push({ field: 'metric', text: `${m.label}: ${m.value}` })
        break // one metric hit per report
      }
    }

    // Insights
    const insights = parseJsonSafe<Array<{ text: string; type: string }>>(r.insights, [])
    for (const i of insights) {
      if (i.text?.toLowerCase().includes(qLower)) {
        matches.push({ field: 'insight', text: highlight(i.text, q) })
        break
      }
    }

    // Questions
    const questions = parseJsonSafe<Array<{ text: string }>>(r.questions, [])
    for (const qq of questions) {
      if (qq.text?.toLowerCase().includes(qLower)) {
        matches.push({ field: 'question', text: highlight(qq.text, q) })
        break
      }
    }

    if (matches.length > 0) {
      hits.push({
        reportId: r.id,
        reportTitle: r.title,
        area: r.area,
        directName: r.directReport?.name,
        date: r.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        matches,
      })
    }
  }

  return NextResponse.json({ hits, total: hits.length })
  } catch (e) {
    console.error('topic-search error:', e)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}

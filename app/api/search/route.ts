import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { loadAiSettings } from '@/lib/settings'
import { parseJsonSafe } from '@/lib/utils'
import { generateEmbedding, cosineSimilarity } from '@/lib/embeddings'

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
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const mode = req.nextUrl.searchParams.get('mode') ?? 'keyword'
  if (q.length < 2) return NextResponse.json({ reports: [], journal: [] })

  // Semantic search mode — uses Ollama embeddings
  if (mode === 'semantic') {
    await loadAiSettings()
    try {
      const allEmbeddings = await prisma.reportEmbedding.findMany({
        include: { report: { select: { id: true, title: true, area: true, summary: true } } },
      })
      if (allEmbeddings.length === 0) {
        // Fall through to keyword search if no embeddings exist
      } else {
        const queryVec = await generateEmbedding(q)
        const scored = new Map<string, { score: number; title: string; area: string; summary: string | null }>()
        for (const emb of allEmbeddings) {
          const vec = JSON.parse(emb.embedding) as number[]
          const sim = cosineSimilarity(queryVec, vec)
          const existing = scored.get(emb.reportId)
          if (!existing || sim > existing.score) {
            scored.set(emb.reportId, {
              score: sim,
              title: emb.report.title,
              area: emb.report.area,
              summary: emb.report.summary,
            })
          }
        }
        const sorted = [...scored.entries()]
          .sort((a, b) => b[1].score - a[1].score)
          .slice(0, 20)
          .filter(([, v]) => v.score > 0.3)

        return NextResponse.json({
          reports: sorted.map(([id, v]) => ({
            id,
            title: v.title,
            area: v.area,
            directReport: null,
            snippet: v.summary?.slice(0, 120) ?? '',
            score: Math.round(v.score * 100) / 100,
          })),
          journal: [],
        })
      }
    } catch (e) {
      console.error('semantic search failed, falling back to keyword:', e)
    }
  }

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
  } catch (e) {
    console.error('search error:', e)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}

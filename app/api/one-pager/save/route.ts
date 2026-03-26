import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

interface Metric { label: string; value: string; status?: string }
interface Insight { type: string; text: string }
interface Question { text: string; why: string; priority: string }

interface InputReport {
  id: string
  title: string
  area: string
  summary: string | null
  metrics: Metric[]
  insights: Insight[]
  questions: Question[]
  directName?: string
  directTitle?: string
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req)
  if (authError) return authError

  const body = await req.json() as { reports: InputReport[]; weekLabel?: string }
  const { reports, weekLabel } = body

  if (!reports?.length) {
    return NextResponse.json({ error: 'No reports provided' }, { status: 400 })
  }

  const label = weekLabel ?? new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const title = `Executive One Pager — ${label}`

  // Build combined plain-text content
  const lines: string[] = [title, '='.repeat(title.length), '']
  for (const r of reports) {
    const from = r.directName ? ` · ${r.directName}${r.directTitle ? `, ${r.directTitle}` : ''}` : ''
    lines.push(`[${r.area}${from}]  ${r.title}`)
    if (r.summary) lines.push(r.summary)
    if (r.metrics.length > 0) {
      lines.push('Metrics: ' + r.metrics.map(m => `${m.label}: ${m.value}`).join(' | '))
    }
    const flags = r.insights.filter(i => i.type === 'risk' || i.type === 'anomaly')
    if (flags.length > 0) {
      lines.push('Flags: ' + flags.map(i => i.text).join(' | '))
    }
    const highQ = r.questions.filter(q => q.priority === 'high')
    if (highQ.length > 0) {
      lines.push('Questions: ' + highQ.map(q => q.text).join(' | '))
    }
    lines.push('')
  }
  const rawContent = lines.join('\n')

  // Aggregate top-level summary from each area's summary
  const summaryParts = reports
    .filter(r => r.summary)
    .map(r => `${r.area}: ${r.summary}`)
  const summary = summaryParts.slice(0, 5).join(' · ') || null

  // Prefix each metric label with its area so the combined set is readable
  const allMetrics: Metric[] = reports.flatMap(r =>
    r.metrics.map(m => ({ ...m, label: `${r.area} — ${m.label}` }))
  )

  // Combine all insights and high-priority questions
  const allInsights: Insight[] = reports.flatMap(r => r.insights)
  const highQuestions: Question[] = reports.flatMap(r => r.questions.filter(q => q.priority === 'high'))

  const report = await prisma.report.create({
    data: {
      title,
      fileName: `one-pager-${Date.now()}.txt`,
      fileType: 'txt',
      fileSize: rawContent.length,
      rawContent,
      area: 'Executive',
      summary,
      metrics: allMetrics.length > 0 ? JSON.stringify(allMetrics) : null,
      insights: allInsights.length > 0 ? JSON.stringify(allInsights) : null,
      questions: highQuestions.length > 0 ? JSON.stringify(highQuestions) : null,
    },
  })

  return NextResponse.json({ reportId: report.id })
}

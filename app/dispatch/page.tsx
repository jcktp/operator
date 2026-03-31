import { prisma } from '@/lib/db'
import { parseJsonSafe, parseMetrics } from '@/lib/utils'
import type { Metric, Insight, Question } from '@/lib/utils'
import { getModeConfig } from '@/lib/mode'
import { buildPatternSummary, formatPatternSummary } from '@/lib/patterns'
import DispatchPageClient from './DispatchPageClient'

export const dynamic = 'force-dynamic'

export default async function DispatchPage() {
  const [chats, reports, providerRow, modeRow] = await Promise.all([
    prisma.dispatchChat.findMany({ orderBy: { updatedAt: 'desc' } }),
    prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, title: true, area: true, reportDate: true, createdAt: true, rawContent: true,
        summary: true, metrics: true, insights: true, questions: true,
        directReport: { select: { name: true } },
      },
    }),
    prisma.setting.findUnique({ where: { key: 'ai_provider' } }),
    prisma.setting.findUnique({ where: { key: 'app_mode' } }),
  ])
  const modeConfig = getModeConfig(modeRow?.value)

  // Cloud models have large context windows; Ollama is much more constrained
  const isCloud = providerRow?.value && providerRow.value !== 'ollama'
  const rawContentLimit = isCloud ? 15000 : 2500
  const docLimit = isCloud ? 20 : 5

  const contextDocs = reports.slice(0, docLimit).map(r => {
    const date = r.reportDate ? new Date(r.reportDate).toISOString().split('T')[0] : null
    const from = r.directReport?.name ? ` | From: ${r.directReport.name}` : ''
    const meta = `Area: ${r.area}${date ? ` | Date: ${date}` : ''}${from}`

    // Analysis section — always complete, no truncation
    const metrics = parseMetrics(r.metrics)
    const insights = parseJsonSafe<Insight[]>(r.insights, [])
    const questions = parseJsonSafe<Question[]>(r.questions, [])
    const analysisLines: string[] = []
    if (r.summary) analysisLines.push(`Summary: ${r.summary}`)
    if (metrics.length) analysisLines.push(`Metrics: ${metrics.map(m => `${m.label}: ${m.value}${m.context ? ` (${m.context})` : ''}`).join(' | ')}`)
    if (insights.length) analysisLines.push(`Flags:\n${insights.map(i => `  [${i.type}] ${i.text}`).join('\n')}`)
    if (questions.length) analysisLines.push(`Questions raised:\n${questions.map(q => `  [${q.priority}] ${q.text}`).join('\n')}`)

    // Raw content — truncated for large documents, with a note if cut
    const raw = r.rawContent ?? ''
    const truncated = raw.length > rawContentLimit
    const rawSection = raw.slice(0, rawContentLimit) + (truncated ? `\n[...document continues — ${Math.round((raw.length - rawContentLimit) / 1000)}k more characters not shown]` : '')

    return [
      `=== DOCUMENT: ${r.title} ===`,
      meta,
      '',
      'AI ANALYSIS (use for questions about flags, risks, metrics, and findings):',
      analysisLines.length ? analysisLines.join('\n') : '(not yet analysed)',
      '',
      'FULL DOCUMENT TEXT (use for specific content questions; may be truncated for large documents):',
      rawSection,
    ].join('\n')
  })

  // Build cross-report pattern summary and prepend to context
  const patternReports = reports.map(r => ({
    area: r.area,
    title: r.title,
    reportDate: r.reportDate?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    summary: r.summary,
    metrics: r.metrics,
    insights: r.insights,
    questions: r.questions,
  }))
  const patterns = buildPatternSummary(patternReports)
  const patternBlock = formatPatternSummary(patterns, modeConfig.documentLabel.toLowerCase())

  const contextLines = [
    `${reports.length} document${reports.length !== 1 ? 's' : ''} available. Each document below has two sections: AI ANALYSIS (complete, always reliable) and FULL DOCUMENT TEXT (may be truncated for very large documents).`,
    '',
    ...(patternBlock ? [
      '=== CROSS-DOCUMENT PATTERNS (automatically detected across all documents) ===',
      patternBlock,
      '=== END PATTERNS ===',
      '',
    ] : []),
    ...contextDocs,
  ]

  const serialized = chats.map(c => {
    const messages = parseJsonSafe<Array<{ role: string; content: string }>>(c.messages, [])
    return {
      id: c.id,
      title: c.title,
      messageCount: messages.length,
      preview: messages.find(m => m.role === 'assistant')?.content.slice(0, 100) ?? '',
      updatedAt: c.updatedAt.toISOString(),
      messages: messages as Array<{ role: 'user' | 'assistant'; content: string }>,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">Dispatch</h1>
        <p className="text-gray-500 dark:text-zinc-400 text-sm mt-0.5">AI conversations about your {modeConfig.documentLabelPlural.toLowerCase()} — auto-saved</p>
      </div>
      <DispatchPageClient chats={serialized} context={contextLines.join('\n')} />
    </div>
  )
}

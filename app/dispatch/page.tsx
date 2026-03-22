import { prisma } from '@/lib/db'
import { parseJsonSafe } from '@/lib/utils'
import type { Metric, Insight } from '@/lib/utils'
import DispatchPageClient from './DispatchPageClient'

export const dynamic = 'force-dynamic'

export default async function DispatchPage() {
  const [chats, reports, directs] = await Promise.all([
    prisma.dispatchChat.findMany({ orderBy: { updatedAt: 'desc' } }),
    prisma.report.findMany({ orderBy: { createdAt: 'desc' }, take: 20, include: { directReport: true } }),
    prisma.directReport.findMany({ orderBy: { name: 'asc' } }),
  ])

  // Build context (same as overview)
  const areaMap: Record<string, typeof reports[0]> = {}
  for (const r of reports) { if (!areaMap[r.area]) areaMap[r.area] = r }
  const activeAreas = Object.values(areaMap)
  const topFlags: string[] = []
  for (const r of reports.slice(0, 10)) {
    parseJsonSafe<Insight[]>(r.insights, [])
      .filter(i => i.type === 'risk' || i.type === 'anomaly')
      .forEach(i => topFlags.push(`[${i.type}] ${i.text}`))
  }
  const contextLines = [
    `Business overview — ${reports.length} reports across ${activeAreas.length} areas.`,
    '',
    'AREAS:',
    ...activeAreas.map(r => {
      const metrics = parseJsonSafe<Metric[]>(r.metrics, []).slice(0, 4)
      return `- ${r.area}: ${r.summary ?? r.title}${metrics.length ? '\n  Metrics: ' + metrics.map(m => `${m.label} ${m.value}`).join(', ') : ''}`
    }),
    ...(topFlags.length ? ['', 'ACTIVE FLAGS:', ...topFlags.slice(0, 5).map(f => `- ${f}`)] : []),
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
        <h1 className="text-2xl font-semibold text-gray-900">Dispatch</h1>
        <p className="text-gray-500 text-sm mt-0.5">AI conversations about your reports — auto-saved</p>
      </div>
      <DispatchPageClient chats={serialized} context={contextLines.join('\n')} />
    </div>
  )
}

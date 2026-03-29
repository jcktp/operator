import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import EntityGraph from './EntityGraph'
import { ArrowLeft } from 'lucide-react'
import type { GraphData } from '@/app/api/entities/graph/route'

export default async function EntityGraphPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>
}) {
  const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  if (modeRow?.value !== 'journalism') notFound()

  const { name } = await searchParams
  if (!name) notFound()

  // Build graph data server-side for initial render
  const centreEntries = await prisma.reportEntity.findMany({
    where: { name: { equals: name } },
    select: { reportId: true, type: true },
  })

  const centreType = centreEntries[0]?.type ?? 'person'
  const centreReportIds = centreEntries.map(e => e.reportId)

  if (centreReportIds.length === 0) notFound()

  const coEntries = await prisma.reportEntity.findMany({
    where: {
      reportId: { in: centreReportIds },
      name: { not: name },
    },
    select: { name: true, type: true, reportId: true },
  })

  const coEntityMap = new Map<string, { type: string; reportIds: Set<string> }>()
  for (const entry of coEntries) {
    if (!coEntityMap.has(entry.name)) {
      coEntityMap.set(entry.name, { type: entry.type, reportIds: new Set() })
    }
    coEntityMap.get(entry.name)!.reportIds.add(entry.reportId)
  }

  const initialData: GraphData = {
    centre: name,
    nodes: [
      { id: name, name, type: centreType, count: centreReportIds.length },
      ...[...coEntityMap.entries()]
        .sort((a, b) => b[1].reportIds.size - a[1].reportIds.size)
        .slice(0, 30)
        .map(([n, data]) => ({ id: n, name: n, type: data.type, count: data.reportIds.size })),
    ],
    edges: [...coEntityMap.entries()]
      .sort((a, b) => b[1].reportIds.size - a[1].reportIds.size)
      .slice(0, 30)
      .map(([n, data]) => ({ source: name, target: n, weight: data.reportIds.size })),
  }

  return (
    <div className="pt-14 h-screen flex flex-col">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shrink-0">
        <Link
          href="/entities"
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft size={12} />
          Entities
        </Link>
        <span className="text-gray-300 dark:text-zinc-600">/</span>
        <span className="text-sm font-medium text-gray-900 dark:text-zinc-50">{name}</span>
        <span className="ml-auto text-xs text-gray-400 dark:text-zinc-500">
          {initialData.nodes.length - 1} related entit{initialData.nodes.length - 1 !== 1 ? 'ies' : 'y'} across {centreReportIds.length} document{centreReportIds.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <EntityGraph initialData={initialData} />
      </div>
    </div>
  )
}

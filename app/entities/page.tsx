import Link from 'next/link'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { formatRelativeDate } from '@/lib/utils'
import { getModeConfig } from '@/lib/mode'
import { Users } from 'lucide-react'
import EntitiesOverviewSearch from './EntitiesOverviewSearch'

export const dynamic = 'force-dynamic'

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string }>
}) {
  const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  const modeConfig = getModeConfig(modeRow?.value)
  if (!modeConfig.features.entities) notFound()

  // Use the label from the matching extraNavItem so each mode shows its own term
  const navItem = modeConfig.features.extraNavItems.find(i => i.href === '/entities')
  const pageTitle = navItem?.label ?? 'Entities'

  const { type: selectedType, sort = 'frequency' } = await searchParams

  const allEntities = await prisma.reportEntity.findMany({
    orderBy: { createdAt: 'desc' },
  })

  // Group by name + type
  const grouped: Record<string, {
    name: string
    type: string
    contexts: string[]
    reportIds: string[]
  }> = {}

  for (const e of allEntities) {
    const key = `${e.type}::${e.name}`
    if (!grouped[key]) {
      grouped[key] = { name: e.name, type: e.type, contexts: [], reportIds: [] }
    }
    if (!grouped[key].reportIds.includes(e.reportId)) {
      grouped[key].reportIds.push(e.reportId)
    }
    if (e.context && !grouped[key].contexts.includes(e.context)) {
      grouped[key].contexts.push(e.context)
    }
  }

  // Fetch all reports for title lookup and date
  const allReportIds = [...new Set(allEntities.map(e => e.reportId))]
  const reports = await prisma.report.findMany({
    where: { id: { in: allReportIds } },
    select: { id: true, title: true, area: true, createdAt: true },
  })
  const reportMap = Object.fromEntries(reports.map(r => [r.id, r]))

  let entityList = Object.values(grouped).map(g => ({
    ...g,
    count: g.reportIds.length,
    latestDate: g.reportIds
      .map(rid => reportMap[rid]?.createdAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0],
    reports: g.reportIds.map(rid => reportMap[rid]).filter(Boolean),
  }))

  // Apply type filter
  if (selectedType) {
    entityList = entityList.filter(e => e.type === selectedType)
  }

  // Sort
  if (sort === 'frequency') {
    entityList.sort((a, b) => b.count - a.count)
  } else if (sort === 'name') {
    entityList.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sort === 'recent') {
    entityList.sort((a, b) => {
      const aTime = a.latestDate ? new Date(a.latestDate).getTime() : 0
      const bTime = b.latestDate ? new Date(b.latestDate).getTime() : 0
      return bTime - aTime
    })
  }

  // Type counts
  const typeCounts: Record<string, number> = { all: Object.values(grouped).length }
  for (const g of Object.values(grouped)) {
    typeCounts[g.type] = (typeCounts[g.type] ?? 0) + 1
  }

  const ENTITY_COLORS: Record<string, string> = {
    person: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800',
    organisation: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
    location: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    date: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    financial: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  }

  const ENTITY_LABELS: Record<string, string> = {
    person: 'People',
    organisation: 'Organisations',
    location: 'Locations',
    date: 'Dates',
    financial: 'Financial',
  }

  const typeOptions = ['person', 'organisation', 'location', 'date', 'financial']

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50 flex items-center gap-2">
            <Users size={20} />
            {pageTitle}
          </h1>
          <p className="text-gray-500 dark:text-zinc-400 text-sm mt-0.5">
            All named entities extracted across your {modeConfig.navLibrary.toLowerCase()}.
          </p>
        </div>
      </div>

      {entityList.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm text-gray-500 dark:text-zinc-400">No entities extracted yet.</p>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Entities are extracted automatically when {modeConfig.documentLabelPlural.toLowerCase()} are analysed.</p>
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          {/* Sidebar */}
          <aside className="w-44 shrink-0 space-y-1 sticky top-24">
            <Link
              href="/entities"
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                !selectedType ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium' : 'text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
              }`}
            >
              <span>All types</span>
              <span className={`text-xs ${!selectedType ? 'text-gray-300 dark:text-zinc-600' : 'text-gray-400 dark:text-zinc-500'}`}>
                {typeCounts.all}
              </span>
            </Link>
            {typeOptions.filter(t => (typeCounts[t] ?? 0) > 0).map(t => (
              <Link
                key={t}
                href={`/entities?type=${t}${sort !== 'frequency' ? `&sort=${sort}` : ''}`}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedType === t ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium' : 'text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                }`}
              >
                <span>{ENTITY_LABELS[t]}</span>
                <span className={`text-xs ${selectedType === t ? 'text-gray-300 dark:text-zinc-600' : 'text-gray-400 dark:text-zinc-500'}`}>
                  {typeCounts[t] ?? 0}
                </span>
              </Link>
            ))}
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Sort controls */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-gray-400 dark:text-zinc-500">Sort by:</span>
              {['frequency', 'name', 'recent'].map(s => (
                <Link
                  key={s}
                  href={`/entities?${selectedType ? `type=${selectedType}&` : ''}sort=${s}`}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    sort === s
                      ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-gray-900 dark:border-zinc-100'
                      : 'bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-500'
                  }`}
                >
                  {s === 'frequency' ? 'Most frequent' : s === 'name' ? 'Name (A–Z)' : 'Most recent'}
                </Link>
              ))}
            </div>

            <EntitiesOverviewSearch
              entities={entityList.map(e => ({
                name: e.name,
                type: e.type,
                count: e.count,
                contexts: e.contexts,
                reports: e.reports.map(r => ({
                  id: r!.id,
                  title: r!.title,
                  area: r!.area,
                  createdAt: r!.createdAt.toISOString(),
                })),
              }))}
              entityColors={ENTITY_COLORS}
              entityLabels={ENTITY_LABELS}
            />
          </div>
        </div>
      )}
    </div>
  )
}

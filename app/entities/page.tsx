import Link from 'next/link'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { formatRelativeDate } from '@/lib/utils'
import { Users } from 'lucide-react'
import EntitiesOverviewSearch from './EntitiesOverviewSearch'

export const dynamic = 'force-dynamic'

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string }>
}) {
  // Only available in journalism mode
  const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  if (modeRow?.value !== 'journalism') notFound()

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
    person: 'bg-violet-50 text-violet-700 border-violet-200',
    organisation: 'bg-sky-50 text-sky-700 border-sky-200',
    location: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    date: 'bg-amber-50 text-amber-700 border-amber-200',
    financial: 'bg-green-50 text-green-700 border-green-200',
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
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Users size={20} />
            Entities
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            All named entities extracted across your story archive.
          </p>
        </div>
      </div>

      {entityList.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm text-gray-500">No entities extracted yet.</p>
          <p className="text-xs text-gray-400 mt-1">Entities are extracted automatically when documents are analysed in Journalism mode.</p>
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          {/* Sidebar */}
          <aside className="w-44 shrink-0 space-y-1 sticky top-24">
            <Link
              href="/entities"
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                !selectedType ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>All types</span>
              <span className={`text-xs ${!selectedType ? 'text-gray-300' : 'text-gray-400'}`}>
                {typeCounts.all}
              </span>
            </Link>
            {typeOptions.filter(t => (typeCounts[t] ?? 0) > 0).map(t => (
              <Link
                key={t}
                href={`/entities?type=${t}${sort !== 'frequency' ? `&sort=${sort}` : ''}`}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedType === t ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{ENTITY_LABELS[t]}</span>
                <span className={`text-xs ${selectedType === t ? 'text-gray-300' : 'text-gray-400'}`}>
                  {typeCounts[t] ?? 0}
                </span>
              </Link>
            ))}
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Sort controls */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-gray-400">Sort by:</span>
              {['frequency', 'name', 'recent'].map(s => (
                <Link
                  key={s}
                  href={`/entities?${selectedType ? `type=${selectedType}&` : ''}sort=${s}`}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    sort === s
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
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

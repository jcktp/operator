import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatRelativeDate, AREA_COLORS } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import LibraryClearButton from './LibraryClearButton'
import LibrarySearch from './LibrarySearch'
import { getModeConfig } from '@/lib/mode'
import SourceProtectionBanner from '@/components/SourceProtectionBanner'

export const dynamic = 'force-dynamic'

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>
}) {
  const { area: selectedArea } = await searchParams

  const [allReports, directs, modeRow] = await Promise.all([
    prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      include: { directReport: true },
    }),
    prisma.directReport.findMany({ orderBy: { name: 'asc' } }),
    prisma.setting.findUnique({ where: { key: 'app_mode' } }),
  ])
  const modeConfig = getModeConfig(modeRow?.value)
  const isJournalism = modeRow?.value === 'journalism'

  // Journalism: fetch entity names and redaction flags per report
  let entityNamesByReport: Record<string, string[]> = {}
  let redactedReportIds = new Set<string>()
  if (isJournalism) {
    const [allEntities, redactedRows] = await Promise.all([
      prisma.reportEntity.findMany({ select: { reportId: true, name: true } }),
      prisma.reportJournalism.findMany({
        where: { redactions: { not: null } },
        select: { reportId: true },
      }),
    ])
    for (const e of allEntities) {
      if (!entityNamesByReport[e.reportId]) entityNamesByReport[e.reportId] = []
      entityNamesByReport[e.reportId].push(e.name)
    }
    redactedReportIds = new Set(redactedRows.map(r => r.reportId))
  }

  // Filter by area if selected
  const reports = selectedArea
    ? allReports.filter(r => r.area === selectedArea)
    : allReports

  // Stats per area
  const areaStats: Record<string, { count: number; latest: Date }> = {}
  for (const r of allReports) {
    if (!areaStats[r.area]) {
      areaStats[r.area] = { count: 0, latest: r.createdAt }
    }
    areaStats[r.area].count++
    if (r.createdAt > areaStats[r.area].latest) {
      areaStats[r.area].latest = r.createdAt
    }
  }

  const usedAreas = Object.keys(areaStats).sort()

  return (
    <div className="space-y-6">
      <SourceProtectionBanner />
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{modeConfig.navLibrary}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            All {modeConfig.documentLabelPlural.toLowerCase()}, by {modeConfig.collectionLabel.toLowerCase()}. Full history with diffs and questions.
          </p>
        </div>
        {allReports.length > 0 && <LibraryClearButton />}
      </div>

      {allReports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
            <FileText size={20} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">No reports yet.</p>
          <Link href="/upload" className="mt-4 inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
            Upload your first report
          </Link>
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          {/* Sidebar — area filter */}
          <aside className="w-44 shrink-0 space-y-1 sticky top-24">
            <Link
              href="/library"
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                !selectedArea
                  ? 'bg-gray-900 text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <span>All areas</span>
              <span className={cn('text-xs', !selectedArea ? 'text-gray-300' : 'text-gray-400')}>
                {allReports.length}
              </span>
            </Link>

            {usedAreas.map(area => {
              const color = AREA_COLORS[area] ?? 'bg-gray-50 text-gray-700 border-gray-200'
              const isActive = selectedArea === area
              return (
                <Link
                  key={area}
                  href={`/library?area=${encodeURIComponent(area)}`}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-gray-900 text-white font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <span className="truncate">{area}</span>
                  <span className={cn('text-xs shrink-0', isActive ? 'text-gray-300' : 'text-gray-400')}>
                    {areaStats[area].count}
                  </span>
                </Link>
              )
            })}
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {selectedArea && (
              <div className="flex items-center gap-3 mb-4">
                <AreaBadge area={selectedArea} />
                <span className="text-sm text-gray-500">
                  {areaStats[selectedArea]?.count} report{areaStats[selectedArea]?.count !== 1 ? 's' : ''}
                  {' · '}last {formatRelativeDate(areaStats[selectedArea]?.latest)}
                </span>
              </div>
            )}
            <LibrarySearch
              reports={reports.map(r => ({
                ...r,
                ...(isJournalism ? {
                  entityNames: entityNamesByReport[r.id] ?? [],
                  hasRedactions: redactedReportIds.has(r.id),
                } : {}),
              }))}
              isJournalism={isJournalism}
            />
          </div>
        </div>
      )}
    </div>
  )
}

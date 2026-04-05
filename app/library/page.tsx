import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatRelativeDate } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'
import { FileText, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import LibraryClearButton from './LibraryClearButton'
import LibrarySearch from './LibrarySearch'
import PhotosGallery from './PhotosGallery'
import { getModeConfig } from '@/lib/mode'
import SourceProtectionBanner from '@/components/SourceProtectionBanner'

export const dynamic = 'force-dynamic'

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; tab?: string }>
}) {
  const { area: selectedArea, tab } = await searchParams
  const showPhotos = tab === 'photos'

  const [modeRow, currentProjectSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'app_mode' } }),
    prisma.setting.findUnique({ where: { key: 'current_project_id' } }),
  ])
  const currentMode = modeRow?.value ?? ''
  const modeConfig = getModeConfig(currentMode)
  const modeWhere = { OR: [{ mode: '' }, { mode: currentMode }] }

  // Validate current project belongs to active mode
  const storedProjectId = currentProjectSetting?.value || null
  let currentProjectId: string | null = storedProjectId
  if (storedProjectId) {
    const proj = await prisma.project.findUnique({ where: { id: storedProjectId }, select: { mode: true } })
    if (proj && proj.mode !== '' && proj.mode !== currentMode) currentProjectId = null
  }

  const [allReports, directs] = await Promise.all([
    prisma.report.findMany({
      where: currentProjectId ? { projectId: currentProjectId } : modeWhere,
      orderBy: { createdAt: 'desc' },
      include: { directReport: true },
    }),
    prisma.directReport.findMany({ orderBy: { name: 'asc' } }),
  ])
  const { entities: showEntities, redactions: showRedactions, timeline: showTimeline } = modeConfig.features

  // Cross-module jump hrefs — resolved per mode to avoid linking to non-existent routes
  const entitiesHref = showEntities ? '/entities?tab=entities' : null
  const timelineHref: string | null = (() => {
    if (!showTimeline) return null
    if (showEntities) return '/entities?tab=timeline'
    return modeConfig.features.extraNavItems.find(i => i.href === '/timeline')?.href ?? null
  })()

  // Optional: fetch entity names and redaction flags per report
  let entityNamesByReport: Record<string, string[]> = {}
  let redactedReportIds = new Set<string>()
  if (showEntities || showRedactions) {
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

  // All image reports (displayContent starts with 'image:')
  const allImages = allReports.filter(r => r.displayContent?.startsWith('image:'))
  const imageCount = allImages.length
  // Apply area filter to photos when an area is selected
  const photoReports = (selectedArea ? allImages.filter(r => r.area === selectedArea) : allImages)
    .map(r => ({
      id: r.id,
      title: r.title,
      area: r.area,
      rawContent: r.rawContent ?? '',
      createdAt: r.createdAt,
      storyName: r.storyName ?? null,
    }))

  return (
    <div className="space-y-6">
      <SourceProtectionBanner />
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">{modeConfig.navLibrary}</h1>
          <p className="text-gray-500 dark:text-zinc-400 text-sm mt-0.5">
            All {modeConfig.documentLabelPlural.toLowerCase()}, by {modeConfig.collectionLabel.toLowerCase()}. Full history with diffs and questions.
          </p>
        </div>
        {allReports.length > 0 && <LibraryClearButton />}
      </div>

      {allReports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center mb-4">
            <FileText size={20} className="text-gray-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm text-gray-500 dark:text-zinc-400">No {modeConfig.documentLabelPlural.toLowerCase()} yet.</p>
          <Link href="/upload" className="mt-4 inline-flex items-center gap-2 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors">
            Upload your first {modeConfig.documentLabel.toLowerCase()}
          </Link>
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          {/* Sidebar — area filter + Photos tab */}
          <aside className="w-44 shrink-0 space-y-1 sticky top-24">
            {/* Documents section */}
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 px-3 pb-1">Documents</p>
            <Link
              href="/library"
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                !selectedArea && !showPhotos
                  ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium'
                  : 'text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
              )}
            >
              <span>All areas</span>
              <span className={cn('text-xs', !selectedArea && !showPhotos ? 'text-gray-300 dark:text-zinc-600' : 'text-gray-400 dark:text-zinc-500')}>
                {allReports.length}
              </span>
            </Link>

            {usedAreas.map(area => {
              const isActive = selectedArea === area && !showPhotos
              return (
                <Link
                  key={area}
                  href={`/library?area=${encodeURIComponent(area)}`}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium'
                      : 'text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                  )}
                >
                  <span className="truncate">{area}</span>
                  <span className={cn('text-xs shrink-0', isActive ? 'text-gray-300 dark:text-zinc-600' : 'text-gray-400 dark:text-zinc-500')}>
                    {areaStats[area].count}
                  </span>
                </Link>
              )
            })}

            {/* Photos section — only shown when there are images */}
            {imageCount > 0 && (
              <>
                <div className="pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 px-3 pb-1">Photos</p>
                </div>
                <Link
                  href={`/library?tab=photos${selectedArea ? `&area=${encodeURIComponent(selectedArea)}` : ''}`}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                    showPhotos && !selectedArea
                      ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium'
                      : 'text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <ImageIcon size={12} />
                    All photos
                  </span>
                  <span className={cn('text-xs', showPhotos && !selectedArea ? 'text-gray-300 dark:text-zinc-600' : 'text-gray-400 dark:text-zinc-500')}>
                    {imageCount}
                  </span>
                </Link>
                {usedAreas.filter(a => allImages.some(r => r.area === a)).map(area => {
                  const areaImageCount = allImages.filter(r => r.area === area).length
                  const isActive = showPhotos && selectedArea === area
                  return (
                    <Link
                      key={`photo-${area}`}
                      href={`/library?tab=photos&area=${encodeURIComponent(area)}`}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                        isActive
                          ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium'
                          : 'text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                      )}
                    >
                      <span className="truncate">{area}</span>
                      <span className={cn('text-xs shrink-0', isActive ? 'text-gray-300 dark:text-zinc-600' : 'text-gray-400 dark:text-zinc-500')}>
                        {areaImageCount}
                      </span>
                    </Link>
                  )
                })}
              </>
            )}
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {selectedArea && (
              <div className="flex items-center gap-3 mb-4">
                <AreaBadge area={selectedArea} />
                <span className="text-sm text-gray-500 dark:text-zinc-400">
                  {showPhotos
                    ? `${photoReports.length} photo${photoReports.length !== 1 ? 's' : ''}`
                    : `${areaStats[selectedArea]?.count} ${areaStats[selectedArea]?.count !== 1 ? modeConfig.documentLabelPlural.toLowerCase() : modeConfig.documentLabel.toLowerCase()}`
                  }
                  {!showPhotos && <>{' · '}last {formatRelativeDate(areaStats[selectedArea]?.latest)}</>}
                </span>
              </div>
            )}
            {showPhotos ? (
              <PhotosGallery photos={photoReports} />
            ) : (
              <LibrarySearch
                reports={reports.map(r => ({
                  ...r,
                  ...(showEntities ? { entityNames: entityNamesByReport[r.id] ?? [] } : {}),
                  ...(showRedactions ? { hasRedactions: redactedReportIds.has(r.id) } : {}),
                }))}
                showEntities={showEntities}
                showRedactions={showRedactions}
                entitiesHref={entitiesHref}
                timelineHref={timelineHref}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

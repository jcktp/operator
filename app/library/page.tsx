import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatRelativeDate } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'
import { FileText, Image as ImageIcon, AudioLines } from 'lucide-react'
import { cn } from '@/lib/utils'
import LibraryClearButton from './LibraryClearButton'
import LibrarySearch from './LibrarySearch'
import PhotosGallery from './PhotosGallery'
import AudioGallery from './AudioGallery'
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
 const showAudio = tab === 'audio'

 const currentProjectSetting = await prisma.setting.findUnique({ where: { key: 'current_project_id' } })
 const modeConfig = getModeConfig(null)
 const currentProjectId: string | null = currentProjectSetting?.value || null

 const [allReports, directs] = await Promise.all([
 prisma.report.findMany({
 where: currentProjectId ? { projectId: currentProjectId } : {},
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

 // All audio reports (displayContent starts with 'audio:')
 const allAudio = allReports.filter(r => r.displayContent?.startsWith('audio:'))
 const audioCount = allAudio.length
 const audioReports = (selectedArea ? allAudio.filter(r => r.area === selectedArea) : allAudio)
 .map(r => {
 const meta = JSON.parse(r.displayContent!.slice(6)) as {
 filePath: string
 diarization: { segments: { speaker: string; start: number; end: number; duration: number }[]; num_speakers: number; duration: number }
 speakerNames: Record<string, string>
 }
 return {
 id: r.id,
 title: r.title,
 area: r.area,
 filePath: meta.filePath,
 diarization: meta.diarization,
 speakerNames: meta.speakerNames,
 createdAt: r.createdAt,
 }
 })

 return (
 <div className="space-y-6">
 <SourceProtectionBanner />
 {/* Header */}
 <div className="sticky top-14 z-20 bg-[var(--background)] border-b border-[var(--border)] flex items-start justify-between py-5 -mx-6 px-6 sm:-mx-8 sm:px-8 mb-0">
 <div>
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">{modeConfig.navLibrary}</h1>
 <p className="text-[var(--text-muted)] text-sm mt-0.5">
 All {modeConfig.documentLabelPlural.toLowerCase()}, by {modeConfig.collectionLabel.toLowerCase()}. Full history with diffs and questions.
 </p>
 </div>
 {allReports.length > 0 && <LibraryClearButton />}
 </div>

 {allReports.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-20 text-center">
 <div className="w-12 h-12 bg-[var(--surface-2)] rounded-[10px] flex items-center justify-center mb-4">
 <FileText size={20} className="text-[var(--text-muted)]" />
 </div>
 <p className="text-sm text-[var(--text-subtle)]">No {modeConfig.documentLabelPlural.toLowerCase()} yet.</p>
 <Link href="/upload"className="mt-4 inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--ink-contrast)] text-sm font-medium h-7 px-3 rounded-[4px] hover:opacity-90 transition-colors">
 Upload your first {modeConfig.documentLabel.toLowerCase()}
 </Link>
 </div>
 ) : (
 <div className="flex gap-6 items-start">
 {/* Sidebar — area filter + Photos tab */}
 <aside className="w-44 shrink-0 space-y-1 sticky top-40">
 {/* Documents section */}
 <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)] px-3 pt-3 pb-1.5">Documents</p>
 <Link
 href="/library"
 className={cn(
 'flex items-center justify-between pl-3 pr-3 py-2 rounded-r-[4px] text-sm transition-colors border-l-2',
 !selectedArea && !showPhotos && !showAudio
 ? 'border-l-[var(--blue)] bg-[rgba(46,76,166,0.05)] text-[var(--ink)] font-semibold '
 : 'border-l-transparent text-[var(--text-subtle)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]'
 )}
 >
 <span>All areas</span>
 <span className={cn('text-xs', !selectedArea && !showPhotos && !showAudio ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)]')}>
 {allReports.length}
 </span>
 </Link>

 {usedAreas.map(area => {
 const isActive = selectedArea === area && !showPhotos && !showAudio
 return (
 <Link
 key={area}
 href={`/library?area=${encodeURIComponent(area)}`}
 className={cn(
 'flex items-center justify-between pl-3 pr-3 py-2 rounded-r-[4px] text-sm transition-colors border-l-2',
 isActive
 ? 'border-l-[var(--blue)] bg-[rgba(46,76,166,0.05)] text-[var(--ink)] font-semibold '
 : 'border-l-transparent text-[var(--text-subtle)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]'
 )}
 >
 <span className="truncate">{area}</span>
 <span className={cn('text-xs shrink-0', isActive ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)]')}>
 {areaStats[area].count}
 </span>
 </Link>
 )
 })}

 {/* Photos section — only shown when there are images */}
 {imageCount > 0 && (
 <>
 <div className="pt-3">
 <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)] px-3 pb-1">Photos</p>
 </div>
 <Link
 href={`/library?tab=photos${selectedArea ? `&area=${encodeURIComponent(selectedArea)}` : ''}`}
 className={cn(
 'flex items-center justify-between h-7 px-2.5 rounded-[4px] text-sm transition-colors',
 showPhotos && !selectedArea
 ? 'bg-[var(--ink)] text-[var(--ink-contrast)] font-medium'
 : 'text-[var(--text-body)] hover:bg-[var(--surface-2)]'
 )}
 >
 <span className="flex items-center gap-1.5">
 <ImageIcon size={12} />
 All photos
 </span>
 <span className={cn('text-xs', showPhotos && !selectedArea ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)]')}>
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
 'flex items-center justify-between h-7 px-2.5 rounded-[4px] text-sm transition-colors',
 isActive
 ? 'bg-[var(--ink)] text-[var(--ink-contrast)] font-medium'
 : 'text-[var(--text-body)] hover:bg-[var(--surface-2)]'
 )}
 >
 <span className="truncate">{area}</span>
 <span className={cn('text-xs shrink-0', isActive ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)]')}>
 {areaImageCount}
 </span>
 </Link>
 )
 })}
 </>
 )}

 {/* Audio section — only shown when there are audio recordings */}
 {audioCount > 0 && (
 <>
 <div className="pt-3">
 <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)] px-3 pb-1">Audio</p>
 </div>
 <Link
 href={`/library?tab=audio${selectedArea ? `&area=${encodeURIComponent(selectedArea)}` : ''}`}
 className={cn(
 'flex items-center justify-between h-7 px-2.5 rounded-[4px] text-sm transition-colors',
 showAudio && !selectedArea
 ? 'bg-[var(--ink)] text-[var(--ink-contrast)] font-medium'
 : 'text-[var(--text-body)] hover:bg-[var(--surface-2)]'
 )}
 >
 <span className="flex items-center gap-1.5">
 <AudioLines size={12} />
 All recordings
 </span>
 <span className="text-xs text-[var(--text-muted)]">{audioCount}</span>
 </Link>
 {usedAreas.filter(a => allAudio.some(r => r.area === a)).map(area => {
 const areaAudioCount = allAudio.filter(r => r.area === area).length
 const isActive = showAudio && selectedArea === area
 return (
 <Link
 key={`audio-${area}`}
 href={`/library?tab=audio&area=${encodeURIComponent(area)}`}
 className={cn(
 'flex items-center justify-between h-7 px-2.5 rounded-[4px] text-sm transition-colors',
 isActive
 ? 'bg-[var(--ink)] text-[var(--ink-contrast)] font-medium'
 : 'text-[var(--text-body)] hover:bg-[var(--surface-2)]'
 )}
 >
 <span className="truncate">{area}</span>
 <span className={cn('text-xs shrink-0', isActive ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)]')}>
 {areaAudioCount}
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
 <span className="text-sm text-[var(--text-subtle)]">
 {showPhotos
 ? `${photoReports.length} photo${photoReports.length !== 1 ? 's' : ''}`
 : showAudio
 ? `${audioReports.length} recording${audioReports.length !== 1 ? 's' : ''}`
 : `${areaStats[selectedArea]?.count} ${areaStats[selectedArea]?.count !== 1 ? modeConfig.documentLabelPlural.toLowerCase() : modeConfig.documentLabel.toLowerCase()}`
 }
 {!showPhotos && !showAudio && <>{' · '}last {formatRelativeDate(areaStats[selectedArea]?.latest)}</>}
 </span>
 </div>
 )}
 {showPhotos ? (
 <PhotosGallery photos={photoReports} />
 ) : showAudio ? (
 <AudioGallery reports={audioReports} />
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

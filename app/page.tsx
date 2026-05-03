import { prisma } from '@/lib/db'
import { parseJsonSafe, parseMetrics } from '@/lib/utils'
import type { Metric, Insight, Question } from '@/lib/utils'
import type { AreaMetricData, MetricPoint } from '@/components/MetricsCharts'
import { FileText, Upload } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import OverviewShell from '@/app/overview/OverviewShell'
import type { OverviewData } from '@/app/overview/OverviewShell'
import OverviewStoriesShell from '@/app/overview/OverviewStoriesShell'
import type { OverviewStoriesData, StoryItem, StoryDocument, StoryEvent } from '@/app/overview/OverviewStoriesShell'
import OnePagerTab from '@/app/overview/OnePagerTab'
import type { OnePagerReport } from '@/app/overview/OnePagerTab'
import { getModeConfig } from '@/lib/mode'
import { getReportLabels } from '@/lib/mode-labels'
import { isValidSession, SESSION_COOKIE } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function parseMetricNumeric(value: string | undefined | null): number | null {
 if (!value) return null
 let s = value.trim().replace(/[£$€¥₹]/g, '').replace(/,/g, '').replace(/%$/, '')
 const suffixMatch = s.match(/^([-\d.]+)\s*([kmb])$/i)
 if (suffixMatch) {
 const n = parseFloat(suffixMatch[1])
 const mult = ({ k: 1e3, m: 1e6, b: 1e9 } as Record<string, number>)[suffixMatch[2].toLowerCase()] ?? 1
 return isNaN(n) ? null : n * mult
 }
 const numMatch = s.match(/^([-\d.]+)/)
 if (numMatch) { const n = parseFloat(numMatch[1]); return isNaN(n) ? null : n }
 return null
}

/** Monday of the week containing `date` (UTC) */
function weekStart(date: Date): number {
 const d = new Date(date)
 d.setUTCHours(0, 0, 0, 0)
 const day = d.getUTCDay()
 d.setUTCDate(d.getUTCDate() - ((day + 6) % 7))
 return d.getTime()
}

function weekLabel(ts: number, index: number): string {
 if (index === 0) return 'Latest'
 const d = new Date(ts)
 return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) + ' week'
}

export default async function OverviewPage({
 searchParams,
}: {
 searchParams: Promise<{ tab?: string; week?: string; from?: string; to?: string; area?: string; view?: string }>
}) {
 const cookieStore = await cookies()
 const token = cookieStore.get(SESSION_COOKIE)?.value
 if (!(await isValidSession(token))) {
 redirect('/login')
 }

 const onboardingRow = await prisma.setting.findUnique({ where: { key: 'onboarding_complete' } })
 if (onboardingRow?.value !== 'true') redirect('/onboarding')

 const params = await searchParams
 const tab = params.tab
 const filterFrom = params.from
 const filterTo = params.to
 const selectedArea = params.area
 const view = params.view  // 'classic' to use legacy area-based OverviewShell

 const fromDate = filterFrom ? new Date(filterFrom) : null
 const toDate = filterTo ? new Date(filterTo + 'T23:59:59') : null

 const currentProjectSetting = await prisma.setting.findUnique({ where: { key: 'current_project_id' } })
 const modeConfig = getModeConfig(null)
 const currentProjectId: string | null = currentProjectSetting?.value || null

 const projectCount = await prisma.project.count()

 if (projectCount === 0) {
 return (
 <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
 <div className="w-14 h-14 bg-[var(--blue-dim)] rounded-[10px] flex items-center justify-center mb-4">
 <FileText size={22} className="text-indigo-400" />
 </div>
 <h1 className="text-xl font-semibold text-[var(--text-bright)] mb-2">
 Start by creating a {modeConfig.projectLabel.toLowerCase()}
 </h1>
 <p className="text-[var(--text-muted)] text-sm max-w-sm mb-6">
 Organise your documents under a {modeConfig.projectLabel.toLowerCase()} to keep everything focused and easy to navigate.
 </p>
 <Link href="/projects"
 className="inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--ink-contrast)] text-sm font-medium h-7 px-3 rounded-[4px] hover:bg-[var(--ink)] transition-colors">
 <Upload size={15} />Create first {modeConfig.projectLabel.toLowerCase()}
 </Link>
 </div>
 )
 }

 // ── One Pager tab (preserved — special tab on overview) ───────────────────
 if (tab === 'one-pager') {
 const allReports = await prisma.report.findMany({
 where: {
 ...(currentProjectId ? { projectId: currentProjectId } : {}),
 ...(fromDate || toDate ? { createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } } : {}),
 },
 orderBy: { createdAt: 'desc' },
 include: { directReport: true },
 })

 const bucketMap: Map<number, typeof allReports> = new Map()
 for (const r of allReports) {
 const key = weekStart(r.createdAt)
 if (!bucketMap.has(key)) bucketMap.set(key, [])
 bucketMap.get(key)!.push(r)
 }
 const buckets = [...bucketMap.entries()].sort((a, b) => b[0] - a[0])
 const weekIndex = Math.min(Math.max(parseInt(params.week ?? '0', 10), 0), buckets.length - 1)
 const [bucketTs, bucketReports] = buckets[weekIndex] ?? [Date.now(), []]

 const onePagerReports: OnePagerReport[] = bucketReports.map(r => ({
 id: r.id,
 title: r.title,
 area: r.area,
 summary: r.summary,
 metrics: parseMetrics(r.metrics),
 insights: parseJsonSafe<Insight[]>(r.insights, []),
 questions: parseJsonSafe<Question[]>(r.questions, []),
 createdAt: r.createdAt.toISOString(),
 directName: r.directReport?.name,
 directTitle: r.directReport?.title,
 }))

 return (
 <OnePagerTab
 reports={onePagerReports}
 weekIndex={weekIndex}
 totalWeeks={buckets.length}
 weekLabel={weekLabel(bucketTs, weekIndex)}
 modeId={modeConfig.id}
 />
 )
 }

 // ── Stories overview (Layout A — default) ─────────────────────────────────
 if (view !== 'classic') {
 // Story = Project. Fetch all in-progress projects; each IS a story.
 const [projects, recentActivityReports] = await Promise.all([
 prisma.project.findMany({
 where: { status: 'in_progress' },
 orderBy: { updatedAt: 'desc' },
 select: {
 id: true, name: true, updatedAt: true,
 narrative: true, storyStatus: true, storyDescription: true,
 storyReportIds: true, storyEvents: true, storyClaimStatuses: true,
 reports: { select: { id: true, title: true, area: true, fileType: true, fileSize: true, createdAt: true, displayContent: true, insights: true } },
 },
 }),
 prisma.report.findMany({
 where: currentProjectId ? { projectId: currentProjectId } : {},
 orderBy: { createdAt: 'desc' },
 select: { id: true, title: true, area: true, createdAt: true, insights: true },
 take: 200,
 }),
 ])

 function flagsListFor(r: { insights: string | null }): Array<{ type: string; text: string }> {
 const list = parseJsonSafe<Insight[]>(r.insights, [])
 return list.filter(i => i.type === 'risk' || i.type === 'anomaly').map(i => ({ type: i.type, text: i.text }))
 }
 function stripHtml(html: string): string {
 return html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
 .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
 .replace(/\s+/g, ' ').trim()
 }

 // Gather reportIds for each story.
 // If storyReportIds is explicitly empty but the project has reports, use ALL project reports
 // so flags/entities/docs are visible without needing a manual attach step.
 const allReportIds = new Set<string>()
 const perStoryReportIds = new Map<string, string[]>()
 for (const p of projects) {
 const explicit = parseJsonSafe<string[]>(p.storyReportIds, [])
 const ids = explicit.length > 0 ? explicit : p.reports.map(r => r.id)
 perStoryReportIds.set(p.id, ids)
 for (const id of ids) allReportIds.add(id)
 }

 const [attachedReports, allEntities] = allReportIds.size > 0
 ? await Promise.all([
   prisma.report.findMany({ where: { id: { in: [...allReportIds] } }, select: { id: true, title: true, area: true, fileType: true, fileSize: true, createdAt: true, displayContent: true, insights: true } }),
   prisma.reportEntity.findMany({ where: { reportId: { in: [...allReportIds] } }, select: { id: true, reportId: true, type: true, name: true }, orderBy: { createdAt: 'asc' } }),
 ])
 : [[], []] as const
 const reportMap = new Map(attachedReports.map(r => [r.id, r]))
 const entitiesByReport = new Map<string, Array<{ id: string; type: string; name: string }>>()
 for (const e of allEntities) {
 if (!entitiesByReport.has(e.reportId)) entitiesByReport.set(e.reportId, [])
 entitiesByReport.get(e.reportId)!.push({ id: e.id, type: e.type, name: e.name })
 }

 const stories: StoryItem[] = projects.map(p => {
 const ids = perStoryReportIds.get(p.id) ?? []
 const docs: StoryDocument[] = ids.map(id => reportMap.get(id)).filter((r): r is NonNullable<typeof r> => !!r)
 .map(r => {
 const docFlags = flagsListFor(r)
 return { id: r.id, title: r.title, area: r.area, fileType: r.fileType, fileSize: r.fileSize, createdAt: r.createdAt.toISOString(), flagCount: docFlags.length, displayContent: r.displayContent, entities: (entitiesByReport.get(r.id) ?? []).slice(0, 12), flags: docFlags.slice(0, 5) }
 })
 const areaCounts: Record<string, number> = {}
 for (const d of docs) areaCounts[d.area] = (areaCounts[d.area] ?? 0) + 1
 const area = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
 const events: StoryEvent[] = parseJsonSafe<StoryEvent[]>(p.storyEvents, [])
 const flagCount = docs.reduce((sum, d) => sum + d.flagCount, 0)
 const storyFlags: Array<{ type: string; text: string; reportTitle: string; reportId: string }> = []
 for (const d of docs) for (const f of d.flags) storyFlags.push({ ...f, reportTitle: d.title, reportId: d.id })
 const seenEntityNames = new Set<string>()
 const storyEntities: Array<{ id: string; type: string; name: string }> = []
 for (const d of docs) for (const ent of d.entities) {
 const k = `${ent.type}:${ent.name.toLowerCase()}`
 if (seenEntityNames.has(k)) continue; seenEntityNames.add(k); storyEntities.push(ent)
 if (storyEntities.length >= 20) break
 }
 const snippet = (() => { const plain = stripHtml(p.narrative); if (!plain) return null; return plain.length > 250 ? plain.slice(0, 247).trimEnd() + '\u2026' : plain })()
 return { id: p.id, title: p.name, status: p.storyStatus as StoryItem['status'], area, description: p.storyDescription, reportIds: ids, events, documents: docs, flagCount, updatedAt: p.updatedAt.toISOString(), draftSnippet: snippet, storyFlags: storyFlags.slice(0, 5), storyEntities }
 })

 const totalDocs = stories.reduce((sum, s) => sum + s.documents.length, 0)
 const totalFlags = stories.reduce((sum, s) => sum + s.flagCount, 0)
 const activeCount = stories.filter(s => s.status !== 'filed').length
 const recentActivity = recentActivityReports.slice(0, 8).map(r => ({ id: r.id, title: r.title, area: r.area, createdAt: r.createdAt.toISOString(), flagCount: parseJsonSafe<Insight[]>(r.insights, []).filter(i => i.type === 'risk' || i.type === 'anomaly').length }))
 const totalReportsInProject = recentActivityReports.length === 200 ? '200+' : String(recentActivityReports.length)
 const allReportsForPicker = recentActivityReports.map(r => ({ id: r.id, title: r.title, area: r.area }))
 const data: OverviewStoriesData = { stories, totalDocs, totalFlags, activeCount, recentActivity, totalReportsInProject, allReports: allReportsForPicker }
 return <OverviewStoriesShell data={data} />
 }

 // ── Classic overview (legacy area-based) — `?view=classic` ────────────────

 const reports_final = await prisma.report.findMany({
 where: {
 ...(currentProjectId ? { projectId: currentProjectId } : {}),
 ...(fromDate || toDate ? { createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } } : {}),
 },
 orderBy: { createdAt: 'desc' },
 include: { directReport: true },
 })
 const directs = await prisma.directReport.findMany({ orderBy: { name: 'asc' } })
 const activeProject = currentProjectId
 ? await prisma.project.findUnique({ where: { id: currentProjectId }, select: { name: true } })
 : null

 if (reports_final.length === 0) {
 return (
 <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
 <div className="w-12 h-12 bg-[var(--surface-2)] rounded-[10px] flex items-center justify-center mb-4">
 <FileText size={20} className="text-[var(--text-muted)] " />
 </div>
 <h1 className="text-xl font-semibold text-[var(--text-bright)] mb-2">
 {activeProject ? `No documents in"${activeProject.name} "yet` : modeConfig.emptyStateTitle}
 </h1>
 <p className="text-[var(--text-muted)] text-sm max-w-sm mb-6">{modeConfig.emptyStateBody}</p>
 <Link href="/upload"
 className="inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--ink-contrast)] text-sm font-medium h-7 px-3 rounded-[4px] hover:bg-[var(--ink)] transition-colors">
 <Upload size={15} />{modeConfig.emptyStateCta}
 </Link>
 </div>
 )
 }

 // Area counts for sidebar
 const areaCounts: Record<string, number> = {}
 for (const r of reports_final) areaCounts[r.area] = (areaCounts[r.area] ?? 0) + 1
 const sidebarAreas = Object.keys(areaCounts).sort().map(name => ({ name, count: areaCounts[name] }))

 const recent = (selectedArea ? reports_final.filter(r => r.area === selectedArea) : reports_final).slice(0, 30)

 let activeAreas: typeof reports_final
 if (selectedArea) {
 activeAreas = recent.slice(0, 6)
 } else {
 const areaMap: Record<string, typeof reports_final[0]> = {}
 for (const r of recent) {
 if (!areaMap[r.area]) areaMap[r.area] = r
 }
 activeAreas = Object.values(areaMap)
 }

 type FlagItem = { text: string; type: string; reportTitle: string; reportId: string }
 type QuestionItem = { text: string; reportTitle: string; directName?: string; reportId: string }
 type ResolvedItem = { text: string; area: string; reportId: string }

 const topInsights: FlagItem[] = []
 const topQuestions: QuestionItem[] = []
 const resolvedFlagItems: ResolvedItem[] = []

 for (const r of recent.slice(0, 10)) {
 parseJsonSafe<Insight[]>(r.insights, [])
 .filter(i => i.type === 'risk' || i.type === 'anomaly')
 .forEach(i => topInsights.push({ text: i.text, type: i.type, reportTitle: r.title, reportId: r.id }))
 parseJsonSafe<Question[]>(r.questions, [])
 .filter(q => q.priority === 'high')
 .forEach(q => topQuestions.push({ text: q.text, reportTitle: r.title, directName: r.directReport?.name, reportId: r.id }))
 parseJsonSafe<string[]>(r.resolvedFlags, [])
 .forEach(text => resolvedFlagItems.push({ text, area: r.area, reportId: r.id }))
 }

 const labels = getReportLabels(modeConfig.id)
 const contextLines: string[] = [
 `${modeConfig.label} overview — ${reports_final.length} ${modeConfig.documentLabelPlural.toLowerCase()} across ${activeAreas.length} ${modeConfig.collectionLabelPlural.toLowerCase()}.`,
 '',
 `${modeConfig.collectionLabelPlural.toUpperCase()}:`,
 ...activeAreas.map(r => {
 const metrics = parseMetrics(r.metrics).slice(0, 4)
 return `- ${r.area}: ${r.summary ?? r.title}${metrics.length ? '\n ' + labels.onePagerMetrics + ': ' + metrics.map(m => `${m.label} ${m.value}`).join(', ') : ''}`
 }),
 ]
 if (topInsights.length > 0) {
 contextLines.push('', `ACTIVE ${labels.flagsPanel.toUpperCase()}:`)
 topInsights.slice(0, 5).forEach(f => contextLines.push(`- [${f.type}] ${f.text}`))
 }
 if (topQuestions.length > 0) {
 contextLines.push('', `${labels.questionsPanel.toUpperCase()}:`)
 topQuestions.slice(0, 5).forEach(q => contextLines.push(`- ${q.text}${q.directName ? ` (${labels.questionsPersonPrefix.toLowerCase()} ${q.directName})` : ''}`))
 }

 const byArea: Record<string, typeof reports_final> = {}
 for (const r of [...recent].reverse()) {
 if (!byArea[r.area]) byArea[r.area] = []
 byArea[r.area].push(r)
 }

 const areaMetrics: AreaMetricData[] = Object.entries(byArea).map(([area, areaReports]) => {
 const labelText: Record<string, string> = {}
 const labelPoints: Record<string, MetricPoint[]> = {}
 for (const r of areaReports) {
 for (const m of parseMetrics(r.metrics).filter(m => m.label && m.value)) {
 const key = m.label.trim().toLowerCase()
 if (!labelText[key]) labelText[key] = m.label.trim()
 if (!labelPoints[key]) labelPoints[key] = []
 labelPoints[key].push({
 date: (r.reportDate ?? r.createdAt).toISOString(),
 displayValue: m.value,
 numericValue: parseMetricNumeric(m.value),
 status: m.status,
 })
 }
 }
 const metrics = Object.keys(labelPoints)
 .filter(key => labelPoints[key].length >= 2)
 .map(key => ({ label: labelText[key], points: labelPoints[key] }))
 return { area, metrics }
 })

 const data: OverviewData = {
 stats: {
 totalReports: reports_final.length,
 areasCount: selectedArea ? 1 : activeAreas.length,
 directsCount: directs.length,
 },
 areas: sidebarAreas,
 selectedArea,
 activeAreas: activeAreas.map(r => ({
 id: r.id,
 area: r.area,
 title: r.title,
 summary: r.summary,
 metrics: parseMetrics(r.metrics),
 createdAt: r.createdAt.toISOString(),
 })),
 topInsights: topInsights.slice(0, 5),
 topQuestions: topQuestions.slice(0, 5),
 resolvedFlagItems: resolvedFlagItems.slice(0, 6),
 recentReports: recent.slice(0, 8).map(r => ({
 id: r.id,
 title: r.title,
 area: r.area,
 createdAt: r.createdAt.toISOString(),
 directName: r.directReport?.name,
 directTitle: r.directReport?.title,
 })),
 context: contextLines.join('\n'),
 areaMetrics: areaMetrics.filter(a => a.metrics.length > 0),
 }

 return <OverviewShell data={data} activeFrom={filterFrom} activeTo={filterTo} />
}

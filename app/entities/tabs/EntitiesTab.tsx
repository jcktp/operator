import Link from 'next/link'
import { prisma } from '@/lib/db'
import type { ModeConfig } from '@/lib/mode'
import EntitiesOverviewSearch from '../EntitiesOverviewSearch'
import EntitiesExportButton from './EntitiesExportButton'

interface Props {
 selectedType?: string
 sort: string
 modeConfig: ModeConfig
 focus?: string
 projectId?: string | null
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

const TYPE_OPTIONS = ['person', 'organisation', 'location', 'date', 'financial']

export default async function EntitiesTab({ selectedType, sort, modeConfig, focus, projectId }: Props) {
 const allEntities = await prisma.reportEntity.findMany({
 where: projectId ? { report: { projectId } } : undefined,
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

 const allReportIds = [...new Set(allEntities.map(e => e.reportId))]
 const reports = await prisma.report.findMany({
 where: {
 id: { in: allReportIds },
 ...(projectId ? { projectId } : {}),
 },
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

 if (selectedType) entityList = entityList.filter(e => e.type === selectedType)

 if (sort === 'frequency') {
 entityList.sort((a, b) => b.count - a.count)
 } else if (sort === 'name') {
 entityList.sort((a, b) => a.name.localeCompare(b.name))
 } else if (sort === 'recent') {
 entityList.sort((a, b) => {
 const aT = a.latestDate ? new Date(a.latestDate).getTime() : 0
 const bT = b.latestDate ? new Date(b.latestDate).getTime() : 0
 return bT - aT
 })
 }

 const typeCounts: Record<string, number> = { all: Object.values(grouped).length }
 for (const g of Object.values(grouped)) {
 typeCounts[g.type] = (typeCounts[g.type] ?? 0) + 1
 }

 if (entityList.length === 0) {
 return (
 <div className="text-center py-20">
 <p className="text-sm text-[var(--text-subtle)]">No entities extracted yet.</p>
 <p className="text-xs text-[var(--text-muted)] mt-1">
 Entities are extracted automatically when {modeConfig.documentLabelPlural.toLowerCase()} are analysed.
 </p>
 </div>
 )
 }

 return (
 <div className="flex gap-6 items-start">
 {/* Sidebar */}
 <aside className="w-44 shrink-0 space-y-1 sticky top-0">
 <Link
 href="/entities?tab=entities"
 className={`flex items-center justify-between h-7 px-2.5 rounded-[4px] text-sm transition-colors ${
 !selectedType
 ? 'bg-[var(--ink)] text-[var(--ink-contrast)] font-medium'
 : 'text-[var(--text-body)] hover:bg-[var(--surface-2)]'
 }`}
 >
 <span>All types</span>
 <span className={`text-xs ${!selectedType ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)]'}`}>
 {typeCounts.all}
 </span>
 </Link>
 {TYPE_OPTIONS.filter(t => (typeCounts[t] ?? 0) > 0).map(t => (
 <Link
 key={t}
 href={`/entities?tab=entities&type=${t}${sort !== 'frequency' ? `&sort=${sort}` : ''}`}
 className={`flex items-center justify-between h-7 px-2.5 rounded-[4px] text-sm transition-colors ${
 selectedType === t
 ? 'bg-[var(--ink)] text-[var(--ink-contrast)] font-medium'
 : 'text-[var(--text-body)] hover:bg-[var(--surface-2)]'
 }`}
 >
 <span>{ENTITY_LABELS[t]}</span>
 <span className={`text-xs ${selectedType === t ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)]'}`}>
 {typeCounts[t] ?? 0}
 </span>
 </Link>
 ))}
 </aside>

 {/* Main content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-4">
 <span className="text-xs text-[var(--text-muted)]">Sort by:</span>
 {['frequency', 'name', 'recent'].map(s => (
 <Link
 key={s}
 href={`/entities?tab=entities${selectedType ? `&type=${selectedType}` : ''}&sort=${s}`}
 className={`text-xs px-2.5 py-1 rounded-[4px] border transition-colors ${
 sort === s
 ? 'bg-[var(--ink)] text-[var(--ink-contrast)] border-[var(--ink)]'
 : 'bg-[var(--surface)] text-[var(--text-body)] border-[var(--border)] hover:border-[var(--border-mid)]'
 }`}
 >
 {s === 'frequency' ? 'Most frequent' : s === 'name' ? 'Name (A–Z)' : 'Most recent'}
 </Link>
 ))}
 <div className="ml-auto">
 <EntitiesExportButton entities={entityList.map(e => ({
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
 }))} />
 </div>
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
 focus={focus}
 />
 </div>
 </div>
 )
}

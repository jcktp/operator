import { prisma } from '@/lib/db'
import { formatRelativeDate, parseJsonSafe } from '@/lib/utils'
import Link from 'next/link'
import { ArrowRight, Users, Building2, MapPin, Calendar, AlertTriangle, BookOpen } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface EntityGroup {
 type: string
 entities: Array<{ name: string; count: number; context?: string | null }>
}

interface ClaimStatus {
 claimId: string
 status: string
 note?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ENTITY_ICONS: Record<string, typeof Users> = {
 person: Users,
 organisation: Building2,
 location: MapPin,
 date: Calendar,
}

const ENTITY_LABEL: Record<string, string> = {
 person: 'People',
 organisation: 'Organisations',
 location: 'Locations',
 date: 'Dates',
 financial: 'Financial',
}

// ── Component ────────────────────────────────────────────────────────────────

export default async function JournalismBrief() {
 // Fetch top entities across all reports — group by name, count occurrences
 const rawEntities = await prisma.reportEntity.groupBy({
 by: ['name', 'type'],
 _count: { id: true },
 orderBy: { _count: { id: 'desc' } },
 take: 40,
 })

 // Build per-type groups, top 6 each, capped at 3 types shown
 const entityMap: Record<string, Array<{ name: string; count: number }>> = {}
 for (const e of rawEntities) {
 if (!entityMap[e.type]) entityMap[e.type] = []
 if (entityMap[e.type].length < 6) {
 entityMap[e.type].push({ name: e.name, count: e._count.id })
 }
 }

 const entityGroups: EntityGroup[] = Object.entries(entityMap)
 .filter(([, items]) => items.length > 0)
 .sort(([a], [b]) => {
 const order = ['person', 'organisation', 'location', 'financial', 'date']
 return (order.indexOf(a) ?? 99) - (order.indexOf(b) ?? 99)
 })
 .slice(0, 4)
 .map(([type, entities]) => ({ type, entities }))

 // Fetch recent timeline events
 const recentEvents = await prisma.timelineEvent.findMany({
 orderBy: [{ dateSortKey: 'desc' }, { createdAt: 'desc' }],
 take: 8,
 include: { report: { select: { id: true, title: true, area: true } } },
 })

 // Fetch stories and count unverified claims
 const stories = await prisma.story.findMany({
 orderBy: { updatedAt: 'desc' },
 take: 10,
 })

 let unverifiedCount = 0
 const storySummaries: Array<{ id: string; title: string; unverified: number; updatedAt: Date }> = []

 for (const s of stories) {
 const claims = parseJsonSafe<ClaimStatus[]>(s.claimStatuses ?? null, [])
 const unverified = claims.filter(c => c.status === 'unverified').length
 unverifiedCount += unverified
 storySummaries.push({ id: s.id, title: s.title, unverified, updatedAt: s.updatedAt })
 }

 const totalEntities = rawEntities.length
 const totalEvents = await prisma.timelineEvent.count()
 const totalStories = stories.length

 const isEmpty = totalEntities === 0 && totalEvents === 0 && totalStories === 0

 if (isEmpty) {
 return (
 <div className="flex flex-col items-center justify-center py-24 text-center">
 <BookOpen size={32} className="text-[var(--border)] mb-4" />
 <p className="text-[var(--text-muted)] text-sm mb-1">No intelligence data yet.</p>
 <p className="text-[var(--text-muted)] text-xs">Upload documents to start building the brief.</p>
 <Link href="/upload" className="mt-4 text-xs text-[var(--blue)] hover:underline flex items-center gap-1">
 Upload documents <ArrowRight size={11} />
 </Link>
 </div>
 )
 }

 return (
 <div className="space-y-8">

 {/* Summary stat row */}
 <div className="grid grid-cols-3 gap-3">
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] px-4 py-3">
 <p className="text-xs text-[var(--text-muted)]">Entities tracked</p>
 <p className="text-2xl font-semibold text-[var(--text-bright)] mt-0.5">{totalEntities}</p>
 </div>
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] px-4 py-3">
 <p className="text-xs text-[var(--text-muted)]">Timeline events</p>
 <p className="text-2xl font-semibold text-[var(--text-bright)] mt-0.5">{totalEvents}</p>
 </div>
 <div className={`rounded-[10px] px-4 py-3 border ${
 unverifiedCount > 0
 ? 'bg-[var(--amber-dim)] border-[var(--amber)]'
 : 'bg-[var(--surface)] border-[var(--border)]'
 }`}>
 <p className="text-xs text-[var(--text-muted)]">Unverified claims</p>
 <p className={`text-2xl font-semibold mt-0.5 ${
 unverifiedCount > 0 ? 'text-[var(--amber)]' : 'text-[var(--text-bright)]'
 }`}>{unverifiedCount}</p>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

 {/* Entity groups */}
 {entityGroups.length > 0 && (
 <section>
 <div className="flex items-center justify-between mb-3">
 <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Key Entities</h2>
 <Link href="/entities" className="text-xs text-[var(--blue)] hover:underline flex items-center gap-0.5">
 All entities <ArrowRight size={10} />
 </Link>
 </div>
 <div className="space-y-4">
 {entityGroups.map(({ type, entities }) => {
 const Icon = ENTITY_ICONS[type] ?? Users
 const label = ENTITY_LABEL[type] ?? type
 return (
 <div key={type}>
 <div className="flex items-center gap-1.5 mb-2">
 <Icon size={11} className="text-[var(--text-muted)]" />
 <span className="text-xs font-medium text-[var(--text-muted)]">{label}</span>
 </div>
 <div className="flex flex-wrap gap-1.5">
 {entities.map(e => (
 <Link
 key={e.name}
 href={`/entities?q=${encodeURIComponent(e.name)}`}
 className="flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-[4px] px-2.5 py-1 text-xs text-[var(--text-body)] hover:border-[var(--blue)] hover:bg-[var(--blue-dim)] transition-colors"
 >
 {e.name}
 {e.count > 1 && (
 <span className="text-[var(--text-muted)] text-[10px]">×{e.count}</span>
 )}
 </Link>
 ))}
 </div>
 </div>
 )
 })}
 </div>
 </section>
 )}

 {/* Recent timeline events */}
 {recentEvents.length > 0 && (
 <section>
 <div className="flex items-center justify-between mb-3">
 <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Timeline</h2>
 <Link href="/entities?tab=timeline" className="text-xs text-[var(--blue)] hover:underline flex items-center gap-0.5">
 Full timeline <ArrowRight size={10} />
 </Link>
 </div>
 <div className="space-y-2">
 {recentEvents.map(ev => (
 <Link
 key={ev.id}
 href={`/reports/${ev.report.id}`}
 className="flex gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-3 hover:border-[var(--border-mid)] hover:shadow-sm transition-all group"
 >
 <div className="shrink-0 mt-0.5">
 <span className="text-[10px] font-mono text-[var(--text-muted)] whitespace-nowrap">
 {ev.dateText.length > 15 ? ev.dateText.slice(0, 15) + '…' : ev.dateText}
 </span>
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-xs text-[var(--text-body)] line-clamp-2 leading-snug">{ev.event}</p>
 <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">{ev.report.area}</p>
 </div>
 </Link>
 ))}
 </div>
 </section>
 )}

 </div>

 {/* Stories with unverified claims */}
 {storySummaries.length > 0 && (
 <section>
 <div className="flex items-center justify-between mb-3">
 <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
 {unverifiedCount > 0 && <AlertTriangle size={11} className="text-amber-500" />}
 Stories
 </h2>
 <Link href="/entities?tab=storyline" className="text-xs text-[var(--blue)] hover:underline flex items-center gap-0.5">
 All stories <ArrowRight size={10} />
 </Link>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
 {storySummaries.map(s => (
 <Link
 key={s.id}
 href={`/entities?tab=storyline`}
 className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] px-4 py-3 hover:border-[var(--border-mid)] hover:shadow-sm transition-all"
 >
 <p className="text-xs font-medium text-[var(--text-body)] line-clamp-2 mb-2">{s.title}</p>
 <div className="flex items-center justify-between">
 <span className="text-[10px] text-[var(--text-muted)]">{formatRelativeDate(s.updatedAt)}</span>
 {s.unverified > 0 && (
 <span className="text-[10px] font-medium bg-[var(--amber-dim)] text-[var(--amber)] px-1.5 py-0.5 rounded">
 {s.unverified} unverified
 </span>
 )}
 </div>
 </Link>
 ))}
 </div>
 </section>
 )}

 </div>
 )
}

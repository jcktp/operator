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
        <BookOpen size={32} className="text-gray-200 dark:text-zinc-700 mb-4" />
        <p className="text-gray-500 dark:text-zinc-400 text-sm mb-1">No intelligence data yet.</p>
        <p className="text-gray-400 dark:text-zinc-500 text-xs">Upload documents to start building the brief.</p>
        <Link href="/upload" className="mt-4 text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
          Upload documents <ArrowRight size={11} />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* Summary stat row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-400 dark:text-zinc-500">Entities tracked</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-zinc-50 mt-0.5">{totalEntities}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-400 dark:text-zinc-500">Timeline events</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-zinc-50 mt-0.5">{totalEvents}</p>
        </div>
        <div className={`rounded-xl px-4 py-3 border ${
          unverifiedCount > 0
            ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'
            : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700'
        }`}>
          <p className="text-xs text-gray-400 dark:text-zinc-500">Unverified claims</p>
          <p className={`text-2xl font-semibold mt-0.5 ${
            unverifiedCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-900 dark:text-zinc-50'
          }`}>{unverifiedCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Entity groups */}
        {entityGroups.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Key Entities</h2>
              <Link href="/entities" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
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
                      <Icon size={11} className="text-gray-400 dark:text-zinc-500" />
                      <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">{label}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {entities.map(e => (
                        <Link
                          key={e.name}
                          href={`/entities?q=${encodeURIComponent(e.name)}`}
                          className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-gray-700 dark:text-zinc-200 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
                        >
                          {e.name}
                          {e.count > 1 && (
                            <span className="text-gray-400 dark:text-zinc-500 text-[10px]">×{e.count}</span>
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
              <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Timeline</h2>
              <Link href="/entities?tab=timeline" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
                Full timeline <ArrowRight size={10} />
              </Link>
            </div>
            <div className="space-y-2">
              {recentEvents.map(ev => (
                <Link
                  key={ev.id}
                  href={`/reports/${ev.report.id}`}
                  className="flex gap-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-3 hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-sm transition-all group"
                >
                  <div className="shrink-0 mt-0.5">
                    <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-500 whitespace-nowrap">
                      {ev.dateText.length > 15 ? ev.dateText.slice(0, 15) + '…' : ev.dateText}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 dark:text-zinc-200 line-clamp-2 leading-snug">{ev.event}</p>
                    <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5 truncate">{ev.report.area}</p>
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
            <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              {unverifiedCount > 0 && <AlertTriangle size={11} className="text-amber-500" />}
              Stories
            </h2>
            <Link href="/entities?tab=storyline" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
              All stories <ArrowRight size={10} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {storySummaries.map(s => (
              <Link
                key={s.id}
                href={`/entities?tab=storyline`}
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-sm transition-all"
              >
                <p className="text-xs font-medium text-gray-800 dark:text-zinc-100 line-clamp-2 mb-2">{s.title}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500">{formatRelativeDate(s.updatedAt)}</span>
                  {s.unverified > 0 && (
                    <span className="text-[10px] font-medium bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
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

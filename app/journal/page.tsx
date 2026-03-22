import { prisma } from '@/lib/db'
import JournalEditor from './JournalEditor'

export const dynamic = 'force-dynamic'

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart)
  end.setUTCDate(end.getUTCDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' }
  const startStr = weekStart.toLocaleDateString('en-US', opts)
  const endStr = end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  return `${startStr} – ${endStr}`
}

export default async function JournalPage() {
  const currentWeekStart = getWeekStart(new Date())

  const entries = await prisma.journalEntry.findMany({
    orderBy: { weekStart: 'desc' },
  })

  // Ensure current week entry exists in the list
  const currentEntry = entries.find(e => {
    const ws = getWeekStart(new Date(e.weekStart))
    return ws.getTime() === currentWeekStart.getTime()
  })

  const pastEntries = entries.filter(e => {
    const ws = getWeekStart(new Date(e.weekStart))
    return ws.getTime() < currentWeekStart.getTime() && e.content.trim().length > 0
  })

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Journal</h1>
        <p className="text-gray-500 text-sm mt-0.5">Weekly notes — one entry per week, saved automatically</p>
      </div>

      {/* Current week editor */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            This week · {formatWeekRange(currentWeekStart)}
          </h2>
        </div>
        <JournalEditor
          weekStart={currentWeekStart.toISOString()}
          initialContent={currentEntry?.content ?? ''}
        />
      </section>

      {/* Past entries */}
      {pastEntries.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Previous weeks</h2>
          <div className="space-y-3">
            {pastEntries.map(entry => {
              const ws = getWeekStart(new Date(entry.weekStart))
              return (
                <details key={entry.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden group">
                  <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50 transition-colors list-none">
                    <span className="text-sm font-medium text-gray-700">{formatWeekRange(ws)}</span>
                    <span className="text-xs text-gray-400 group-open:hidden">
                      {entry.content.trim().split('\n')[0].slice(0, 60) || 'No preview'}
                    </span>
                  </summary>
                  <div className="border-t border-gray-100">
                    <JournalEditor
                      weekStart={ws.toISOString()}
                      initialContent={entry.content}
                      compact
                    />
                  </div>
                </details>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

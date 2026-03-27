import { Clock } from 'lucide-react'

export interface TimelineItem {
  id: string
  dateText: string
  dateSortKey: string | null
  event: string
}

export default function TimelineSection({ events }: { events: TimelineItem[] }) {
  if (events.length === 0) return null

  return (
    <section>
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Clock size={11} />
        Timeline
      </h2>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="relative">
          {events.map((event, i) => (
            <div key={event.id} className="flex items-start gap-4 px-4 py-3 border-b border-gray-100 last:border-b-0">
              {/* Timeline line */}
              <div className="flex flex-col items-center shrink-0 pt-1">
                <div className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                {i < events.length - 1 && (
                  <div className="w-px flex-1 bg-gray-100 mt-1 min-h-[12px]" />
                )}
              </div>
              <div className="flex-1 min-w-0 pb-0">
                <p className="text-xs font-medium text-gray-500 mb-0.5">{event.dateText}</p>
                <p className="text-sm text-gray-700">{event.event}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

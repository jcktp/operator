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
 <h2 className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] mb-3 flex items-center gap-1.5">
 <Clock size={11} />
 Timeline
 </h2>
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
 <div className="relative">
 {events.map((event, i) => (
 <div key={event.id} className="flex items-start gap-4 px-4 py-3 border-b border-[var(--border)] last:border-b-0">
 {/* Timeline line */}
 <div className="flex flex-col items-center shrink-0 pt-1">
 <div className="w-2 h-2 rounded-full bg-[var(--border-mid)] shrink-0" />
 {i < events.length - 1 && (
 <div className="w-px flex-1 bg-[var(--border)] mt-1 min-h-[12px]" />
 )}
 </div>
 <div className="flex-1 min-w-0 pb-0">
 <p className="text-xs font-medium text-[var(--text-subtle)] mb-0.5">{event.dateText}</p>
 <p className="text-sm text-[var(--text-body)]">{event.event}</p>
 </div>
 </div>
 ))}
 </div>
 </div>
 </section>
 )
}

import Link from 'next/link'
import { AlertTriangle, HelpCircle, ArrowRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'

interface FlagItem { text: string; area: string; type: string; reportId: string }
interface QuestionItem { text: string; area: string; directName?: string; reportId: string }
interface TimelineEvent {
  id: string; event: string; dateText: string
  report: { id: string; title: string; area: string }
}

interface Props {
  allFlags: FlagItem[]
  allQuestions: QuestionItem[]
  recentEvents: TimelineEvent[]
  documentLabel: string
}

export default function DashboardFlagsQuestions({ allFlags, allQuestions, recentEvents, documentLabel }: Props) {
  if (allFlags.length === 0 && allQuestions.length === 0) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {allFlags.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <AlertTriangle size={11} /> Flags & Risks
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allFlags.slice(0, 6).map((f, i) => (
              <Link key={i} href={`/reports/${f.reportId}`}
                className="group bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4 hover:border-[var(--red)] hover:shadow-sm transition-all flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-xs font-bold px-1.5 py-0.5 rounded',
                    f.type === 'risk' ? 'bg-[var(--red-dim)] text-[var(--red)]' : 'bg-[var(--amber-dim)] text-[var(--amber)]'
                  )}>
                    {f.type}
                  </span>
                  <AreaBadge area={f.area} />
                </div>
                <p className="text-sm text-[var(--text-body)] leading-snug line-clamp-3">{f.text}</p>
                <span className="text-xs text-[var(--text-muted)] group-hover:text-[var(--text-subtle)] flex items-center gap-0.5 mt-auto">
                  View {documentLabel.toLowerCase()} <ArrowRight size={10} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {allQuestions.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <HelpCircle size={11} /> Questions to ask
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allQuestions.slice(0, 6).map((q, i) => (
              <Link key={i} href={`/reports/${q.reportId}`}
                className="group bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4 hover:border-[var(--blue)] hover:shadow-sm transition-all flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-[var(--blue-dim)] text-[var(--blue)]">?</span>
                  <AreaBadge area={q.area} />
                  {q.directName && <span className="text-xs text-[var(--text-muted)]">{q.directName}</span>}
                </div>
                <p className="text-sm text-[var(--text-body)] font-medium leading-snug line-clamp-3">{q.text}</p>
                <span className="text-xs text-[var(--text-muted)] group-hover:text-[var(--text-subtle)] flex items-center gap-0.5 mt-auto">
                  View {documentLabel.toLowerCase()} <ArrowRight size={10} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {recentEvents.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Clock size={11} /> Recent Events
          </h2>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] shadow-sm p-5">
            <div className="relative border-l-2 border-[var(--border)] ml-1">
              {recentEvents.map(e => (
                <div key={e.id} className="relative pl-6 pb-4 last:pb-0">
                  <span className="absolute left-[-5px] top-[6px] w-2.5 h-2.5 rounded-full border-2 bg-[var(--surface)] border-[var(--border-mid)]" />
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">{e.dateText}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-muted)]">{e.report.area}</span>
                  </div>
                  <p className="text-sm text-[var(--text-body)] leading-snug">{e.event}</p>
                  <Link
                    href={`/reports/${e.report.id}`}
                    className="text-xs text-[var(--blue)] hover:underline mt-0.5 block"
                  >
                    {e.report.title}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

import Link from 'next/link'
import { ArrowRight, Clock } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import type { Metric } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'
import { TrendIcon, HealthBar } from './DashboardCards'

interface ComparisonChange {
  metric: string; previous: string; current: string
  direction: 'improved' | 'declined' | 'unchanged' | 'new' | 'removed'
  significance: 'high' | 'medium' | 'low'
}

interface AreaCard {
  area: string
  latest: { createdAt: Date; summary: string | null }
  metrics: Metric[]
  changes: ComparisonChange[]
  health: number
  count: number
}

interface Props {
  areaCards: AreaCard[]
  documentLabel: string
  documentLabelPlural: string
}

export default function DashboardAreaCards({ areaCards, documentLabel, documentLabelPlural }: Props) {
  return (
    <section>
      <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Areas</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {areaCards.map(({ area, latest, metrics, changes, health, count }) => {
          const improved = changes.filter(c => c.direction === 'improved').length
          const declined = changes.filter(c => c.direction === 'declined').length
          const trend: 'up' | 'down' | 'flat' =
            improved > declined ? 'up' : declined > improved ? 'down' : 'flat'

          return (
            <div key={area} className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden hover:border-[var(--border-mid)] hover:shadow-sm transition-all">
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AreaBadge area={area} />
                    <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                      <Clock size={10} />{formatRelativeDate(latest.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendIcon trend={trend} />
                    <HealthBar score={health} />
                  </div>
                </div>

                {latest.summary && (
                  <p className="text-sm text-[var(--text-subtle)] line-clamp-2 leading-relaxed mb-4">{latest.summary}</p>
                )}

                {metrics.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {metrics.map((m, i) => (
                      <div key={i} className={cn(
                        'rounded-[10px] px-3 py-2.5',
                        m.status === 'positive' ? 'bg-[var(--green-dim)]' :
                        m.status === 'negative' ? 'bg-[var(--red-dim)]' :
                        m.status === 'warning' ? 'bg-[var(--amber-dim)]' : 'bg-[var(--surface-2)]'
                      )}>
                        <p className="text-xs text-[var(--text-muted)] truncate">{m.label}</p>
                        <p className={cn(
                          'text-base font-semibold mt-0.5',
                          m.status === 'positive' ? 'text-[var(--green)]' :
                          m.status === 'negative' ? 'text-[var(--red)]' :
                          m.status === 'warning' ? 'text-[var(--amber)]' : 'text-[var(--text-bright)]'
                        )}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {changes.length > 0 && (
                <div className="border-t border-[var(--border)] px-5 py-3 flex gap-4 overflow-x-auto">
                  {changes.slice(0, 3).map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 shrink-0 text-xs">
                      <span className={cn('font-bold',
                        c.direction === 'improved' ? 'text-[var(--green)]' :
                        c.direction === 'declined' ? 'text-[var(--red)]' : 'text-[var(--text-muted)]'
                      )}>
                        {c.direction === 'improved' ? '↑' : c.direction === 'declined' ? '↓' : '→'}
                      </span>
                      <span className="text-[var(--text-muted)] truncate max-w-[120px]">{c.metric}</span>
                      <span className="text-[var(--text-muted)] font-mono">{c.current}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-[var(--border)] px-5 py-3 flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">{count} {count !== 1 ? documentLabelPlural.toLowerCase() : documentLabel.toLowerCase()}</span>
                <Link href={`/library?area=${encodeURIComponent(area)}`}
                  className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-bright)] transition-colors font-medium">
                  View all <ArrowRight size={11} />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

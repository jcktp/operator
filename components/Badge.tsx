import { cn, getAreaColor } from '@/lib/utils'

export function AreaBadge({ area, className }: { area: string; className?: string }) {
  const color = getAreaColor(area)
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        color,
        className
      )}
    >
      {area}
    </span>
  )
}

const STATUS_STYLES = {
  positive: {
    bg:   'var(--green-dim)',
    text: 'var(--green)',
  },
  negative: {
    bg:   'var(--red-dim)',
    text: 'var(--red)',
  },
  neutral: {
    bg:   'var(--surface-3)',
    text: 'var(--text-subtle)',
  },
  warning: {
    bg:   'var(--amber-dim)',
    text: 'var(--amber)',
  },
} as const

const STATUS_LABELS = {
  positive: '↑',
  negative: '↓',
  neutral:  '→',
  warning:  '⚠',
} as const

export function StatusBadge({
  status,
  className,
}: {
  status: 'positive' | 'negative' | 'neutral' | 'warning'
  className?: string
}) {
  const s = STATUS_STYLES[status]
  return (
    <span
      className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium', className)}
      style={{ background: s.bg, color: s.text }}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

const INSIGHT_STYLES: Record<string, { bg: string; text: string }> = {
  observation: { bg: 'var(--blue-dim)',  text: 'var(--blue)'  },
  anomaly:     { bg: 'var(--amber-dim)', text: 'var(--amber)' },
  risk:        { bg: 'var(--red-dim)',   text: 'var(--red)'   },
  opportunity: { bg: 'var(--green-dim)', text: 'var(--green)' },
}

const INSIGHT_FALLBACK = { bg: 'var(--surface-3)', text: 'var(--text-subtle)' }

export function InsightTypeBadge({ type }: { type: string }) {
  const s = INSIGHT_STYLES[type] ?? INSIGHT_FALLBACK
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium capitalize"
      style={{ background: s.bg, color: s.text }}
    >
      {type}
    </span>
  )
}

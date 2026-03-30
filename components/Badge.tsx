import { cn, AREA_COLORS } from '@/lib/utils'

interface BadgeProps {
  label: string
  variant?: 'area' | 'status' | 'type'
  className?: string
}

export function AreaBadge({ area, className }: { area: string; className?: string }) {
  const color = AREA_COLORS[area] ?? 'bg-gray-50 text-gray-700 border-gray-200'
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

export function StatusBadge({
  status,
  className,
}: {
  status: 'positive' | 'negative' | 'neutral' | 'warning'
  className?: string
}) {
  const colors = {
    positive: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
    negative: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
    neutral: 'bg-gray-50 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  }
  const labels = {
    positive: '↑',
    negative: '↓',
    neutral: '→',
    warning: '⚠',
  }
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium', colors[status], className)}>
      {labels[status]}
    </span>
  )
}

export function InsightTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    observation: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    anomaly: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    risk: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
    opportunity: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  }
  return (
    <span className={cn('inline-flex items-center justify-center w-24 shrink-0 px-1.5 py-0.5 rounded text-xs font-medium capitalize', colors[type] ?? 'bg-gray-50 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400')}>
      {type}
    </span>
  )
}

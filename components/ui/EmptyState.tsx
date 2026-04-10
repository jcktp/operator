import { cn } from '@/lib/utils'
import type React from 'react'

interface EmptyStateProps {
  icon?:        React.ReactNode
  title:        string
  description?: string
  action?:      React.ReactNode
  className?:   string
  size?:        'sm' | 'md' | 'lg'
}

const SIZE = {
  sm: { wrap: 'py-8  gap-2', icon: 'mb-2 w-8  h-8',  title: 'text-xs font-medium', desc: 'text-xs' },
  md: { wrap: 'py-12 gap-2', icon: 'mb-3 w-9  h-9',  title: 'text-sm font-medium', desc: 'text-xs' },
  lg: { wrap: 'py-16 gap-3', icon: 'mb-3 w-10 h-10', title: 'text-sm font-medium', desc: 'text-sm' },
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  size = 'md',
}: EmptyStateProps) {
  const s = SIZE[size]
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', s.wrap, className)}>
      {icon && (
        <div className={cn('text-[var(--text-muted)]', s.icon)}>
          {icon}
        </div>
      )}
      <p className={cn('text-[var(--text-subtle)]', s.title)}>{title}</p>
      {description && (
        <p className={cn('text-[var(--text-muted)] max-w-xs', s.desc)}>{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

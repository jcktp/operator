import { cn } from '@/lib/utils'

interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

export default function Separator({ orientation = 'horizontal', className }: SeparatorProps) {
  if (orientation === 'vertical') {
    return (
      <div
        className={cn('self-stretch w-px bg-[var(--border)]', className)}
      />
    )
  }
  return (
    <div
      className={cn('w-full h-px bg-[var(--border)]', className)}
    />
  )
}

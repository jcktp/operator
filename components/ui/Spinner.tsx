import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE = {
  xs: 'w-3   h-3   border-[1.5px]',
  sm: 'w-4   h-4   border-2',
  md: 'w-5   h-5   border-2',
  lg: 'w-6   h-6   border-[2.5px]',
}

export default function Spinner({ size = 'sm', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'rounded-full border-[var(--border-mid)] border-t-[var(--text-subtle)] animate-spin shrink-0',
        SIZE[size],
        className,
      )}
    />
  )
}

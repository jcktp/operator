'use client'

import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type React from 'react'

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Visual size — matches Button heights so they line up when placed side-by-side. */
  size?: 'sm' | 'md' | 'lg'
  /** Show a clear-X button when value is non-empty (calls `onClear` or sets value to ''). */
  clearable?: boolean
  onClear?: () => void
}

const SIZE: Record<NonNullable<Props['size']>, { box: string; pad: string; icon: number; text: string }> = {
  sm: { box: 'h-7', pad: 'pl-7   pr-2.5', icon: 11, text: 'text-[11px]' },
  md: { box: 'h-8', pad: 'pl-8   pr-3',   icon: 12, text: 'text-xs' },
  lg: { box: 'h-9', pad: 'pl-9   pr-3',   icon: 13, text: 'text-sm' },
}

export default function SearchInput({
  size = 'md',
  clearable = false,
  onClear,
  className,
  value,
  onChange,
  ...props
}: Props) {
  const s = SIZE[size]
  const showClear = clearable && typeof value === 'string' && value.length > 0
  return (
    <div className={cn('relative', className)}>
      <Search
        size={s.icon}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
      />
      <input
        type="text"
        value={value}
        onChange={onChange}
        {...props}
        className={cn(
          'w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)]',
          'text-[var(--text-body)] placeholder:text-[var(--text-muted)]',
          'focus:outline-none focus:ring-1 focus:ring-[var(--blue)] focus:border-[var(--blue)]',
          'disabled:opacity-40 disabled:pointer-events-none transition-colors',
          s.box,
          s.pad,
          s.text,
          showClear ? 'pr-7' : '',
        )}
      />
      {showClear && (
        <button
          type="button"
          onClick={() => {
            if (onClear) onClear()
            else if (onChange) {
              const fakeEvent = { target: { value: '' } } as React.ChangeEvent<HTMLInputElement>
              onChange(fakeEvent)
            }
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors"
          aria-label="Clear search"
        >
          <X size={s.icon} />
        </button>
      )}
    </div>
  )
}

import { cn } from '@/lib/utils'
import type React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Visual size preset — does not affect the native `size` attribute */
  inputSize?: 'sm' | 'md' | 'lg'
}

const SIZE = {
  sm: 'h-7  px-2   text-xs',
  md: 'h-8  px-2.5 text-xs',
  lg: 'h-9  px-3   text-sm',
}

const BASE =
  'w-full rounded-[6px] border border-[var(--border-mid)] bg-[var(--surface)] ' +
  'text-[var(--text-body)] placeholder:text-[var(--text-muted)] ' +
  'focus:outline-none focus:ring-1 focus:ring-[var(--blue)] focus:border-[var(--blue)] ' +
  'disabled:opacity-40 disabled:pointer-events-none transition-colors'

export default function Input({ inputSize = 'md', className, ...props }: InputProps) {
  return (
    <input
      {...props}
      className={cn(BASE, SIZE[inputSize], className)}
    />
  )
}

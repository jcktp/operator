import { cn } from '@/lib/utils'
import type React from 'react'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  textareaSize?: 'sm' | 'md' | 'lg'
}

const SIZE = {
  sm: 'px-2   py-1.5 text-xs',
  md: 'px-2.5 py-2   text-xs',
  lg: 'px-3   py-2.5 text-sm',
}

const BASE =
  'w-full rounded-[4px] border border-[var(--border-mid)] bg-[var(--surface)] ' +
  'text-[var(--text-body)] placeholder:text-[var(--text-muted)] ' +
  'focus:outline-none focus:ring-1 focus:ring-[var(--ink)] focus:border-[var(--ink)] ' +
  'resize-none disabled:opacity-40 disabled:pointer-events-none transition-colors'

export default function Textarea({ textareaSize = 'md', className, ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      className={cn(BASE, SIZE[textareaSize], className)}
    />
  )
}

import { cn } from '@/lib/utils'
import type React from 'react'

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'destructive' | 'nav'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?:    ButtonSize
  children: React.ReactNode
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:     'bg-[var(--ink)] text-[var(--ink-contrast)] hover:opacity-90',
  ghost:       'bg-transparent text-[var(--text-body)] hover:bg-[var(--ink)] hover:text-[var(--ink-contrast)]',
  outline:     'bg-transparent border border-[var(--border-mid)] text-[var(--text-body)] hover:bg-[var(--ink)] hover:text-[var(--ink-contrast)] hover:border-[var(--ink)]',
  destructive: 'bg-[var(--red)] text-white hover:opacity-85',
  nav:         'bg-transparent text-white/65 hover:bg-white/[0.12] hover:text-white',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-7  px-2.5 text-xs gap-1.5',
  md: 'h-8  px-3   text-xs gap-2',
  lg: 'h-9  px-4   text-sm gap-2',
}

export default function Button({
  variant = 'primary',
  size    = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-[4px] transition-colors whitespace-nowrap select-none',
        'disabled:opacity-40 disabled:pointer-events-none',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
    >
      {children}
    </button>
  )
}

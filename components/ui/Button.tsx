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
  primary:     'bg-[var(--ink)] text-[var(--ink-contrast)] hover:opacity-90 rounded-full',
  ghost:       'bg-transparent text-[var(--text-body)] hover:bg-[var(--ink)] hover:text-[var(--ink-contrast)] rounded-[6px]',
  outline:     'bg-transparent border border-[var(--border-mid)] text-[var(--text-body)] hover:bg-[var(--ink)] hover:text-[var(--ink-contrast)] hover:border-[var(--ink)] rounded-full',
  destructive: 'bg-[var(--red)] text-white hover:opacity-85 rounded-[6px]',
  nav:         'bg-transparent text-white/65 hover:bg-white/[0.12] hover:text-white rounded-[6px]',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-7  px-3   text-xs gap-1.5',
  md: 'h-8  px-4   text-xs gap-2',
  lg: 'h-9  px-5   text-sm gap-2',
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
        'inline-flex items-center justify-center font-medium transition-colors whitespace-nowrap select-none',
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

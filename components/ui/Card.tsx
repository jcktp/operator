import { cn } from '@/lib/utils'
import type React from 'react'

type CardVariant = 'default' | 'flat' | 'inset'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  children: React.ReactNode
}

const VARIANT: Record<CardVariant, string> = {
  // White card, subtle border — standard surface
  default: 'bg-[var(--surface)] border border-[var(--border)]',
  // Off-white / surface-2 — for nested content, chat panels, etc.
  flat:    'bg-[var(--surface-2)] border border-[var(--border)]',
  // Inset panel inside another card
  inset:   'bg-[var(--surface-3)] border border-[var(--border)]',
}

export default function Card({ variant = 'default', className, children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cn(
        'rounded-[10px]',
        VARIANT[variant],
        className,
      )}
    >
      {children}
    </div>
  )
}

// Convenience sub-components for common card sections
export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn('flex items-center justify-between px-4 py-3 border-b border-[var(--border)]', className)}
    >
      {children}
    </div>
  )
}

export function CardBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cn('px-4 py-3', className)}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn('flex items-center px-4 py-2.5 border-t border-[var(--border)]', className)}
    >
      {children}
    </div>
  )
}

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatRelativeDate(date: string | Date): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return formatDate(date)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const AREAS = [
  'Finance',
  'HR & People',
  'Sales',
  'Marketing',
  'Operations',
  'Product',
  'Engineering',
  'Legal',
  'Customer Success',
  'Recruitment',
  'Strategy',
  'Other',
]

export const AREA_COLORS: Record<string, string> = {
  Finance: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'HR & People': 'bg-violet-50 text-violet-700 border-violet-200',
  Sales: 'bg-blue-50 text-blue-700 border-blue-200',
  Marketing: 'bg-pink-50 text-pink-700 border-pink-200',
  Operations: 'bg-orange-50 text-orange-700 border-orange-200',
  Product: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Engineering: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Legal: 'bg-slate-50 text-slate-700 border-slate-200',
  'Customer Success': 'bg-teal-50 text-teal-700 border-teal-200',
  Recruitment: 'bg-amber-50 text-amber-700 border-amber-200',
  Strategy: 'bg-rose-50 text-rose-700 border-rose-200',
  Other: 'bg-gray-50 text-gray-700 border-gray-200',
}

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

export function parseJsonSafe<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try { return JSON.parse(s) as T } catch { return fallback }
}

// ── Shared report data types ─────────────────────────────────────────────────

export interface Metric {
  label: string
  value: string
  context?: string
  trend?: 'up' | 'down' | 'flat' | 'unknown'
  status?: 'positive' | 'negative' | 'neutral' | 'warning'
}

export interface Insight {
  type: 'observation' | 'anomaly' | 'risk' | 'opportunity'
  text: string
  area?: string
}

export interface Question {
  text: string
  why: string
  priority: 'high' | 'medium' | 'low'
}

export const AREA_COLORS: Record<string, string> = {
  Finance: 'bg-sky-50 text-sky-700 border-sky-200',
  'HR & People': 'bg-violet-50 text-violet-700 border-violet-200',
  Sales: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Marketing: 'bg-pink-50 text-pink-700 border-pink-200',
  Operations: 'bg-stone-50 text-stone-600 border-stone-200',
  Product: 'bg-purple-50 text-purple-700 border-purple-200',
  Engineering: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Legal: 'bg-zinc-50 text-zinc-600 border-zinc-200',
  'Customer Success': 'bg-teal-50 text-teal-700 border-teal-200',
  Recruitment: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  Strategy: 'bg-slate-50 text-slate-600 border-slate-200',
  Other: 'bg-gray-50 text-gray-600 border-gray-200',
}

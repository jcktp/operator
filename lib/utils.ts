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

/** Parse and sanitise a metrics JSON string, dropping any entries where label or value is not a plain string. */
export function parseMetrics(json: string | null | undefined): Metric[] {
  const raw = parseJsonSafe<unknown[]>(json ?? null, [])
  return raw.filter((m): m is Metric => {
    if (!m || typeof m !== 'object') return false
    const o = m as Record<string, unknown>
    const label = o.label ?? o.name
    const value = o.value
    return typeof label === 'string' && typeof value === 'string' && label.length > 0
  }).map(m => {
    const o = m as unknown as Record<string, unknown>
    return {
      label: (o.label ?? o.name) as string,
      value: o.value as string,
      ...(typeof o.context === 'string' ? { context: o.context } : {}),
      ...(typeof o.trend === 'string' ? { trend: o.trend as Metric['trend'] } : {}),
      ...(typeof o.status === 'string' ? { status: o.status as Metric['status'] } : {}),
    }
  })
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

// ── JSON extraction helper (shared by ai.ts and ai-journalism.ts) ────────────
// Handles fenced code blocks, bare objects, and bare arrays.
export function extractJsonFromText(text: string): string {
  const t = text.trim()
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    const candidate = fenced[1].trim()
    try { JSON.parse(candidate); return candidate } catch {}
  }
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start !== -1 && end > start) {
    const candidate = t.slice(start, end + 1)
    try { JSON.parse(candidate); return candidate } catch {}
  }
  const aStart = t.indexOf('[')
  const aEnd = t.lastIndexOf(']')
  if (aStart !== -1 && aEnd > aStart) {
    const candidate = t.slice(aStart, aEnd + 1)
    try { JSON.parse(candidate); return candidate } catch {}
  }
  throw new Error(`No valid JSON in response (len=${t.length}, preview=${t.slice(0, 100)})`)
}

export const AREA_COLORS: Record<string, string> = {
  Finance: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
  'HR & People': 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800',
  Sales: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
  Marketing: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800',
  Operations: 'bg-stone-50 text-stone-600 border-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700',
  Product: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
  Engineering: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800',
  Legal: 'bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-600',
  'Customer Success': 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800',
  Recruitment: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950 dark:text-fuchsia-300 dark:border-fuchsia-800',
  Strategy: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
  Other: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600',
}

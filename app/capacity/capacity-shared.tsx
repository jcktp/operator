import { cn } from '@/lib/utils'

export const HC_STATUSES = ['planning', 'recruiting', 'on_hold', 'filled'] as const
export const HC_STATUS_LABEL: Record<string, string> = {
  planning: 'Planning', recruiting: 'Recruiting', on_hold: 'On hold', filled: 'Filled',
}
export const HC_STATUS_COLOR: Record<string, string> = {
  planning: 'text-[var(--amber)]',
  recruiting: 'text-blue-600',
  on_hold: 'text-[var(--text-muted)]',
  filled: 'text-emerald-600',
}

export const inputCls = 'w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30'
export const numCls = 'h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 w-24 text-right'

export function StatCard({ label, value, sub, accent, status }: {
  label: string; value: string; sub?: string; accent?: boolean
  status?: 'green' | 'yellow' | 'red'
}) {
  const borderCls = status === 'red' ? 'border-[var(--red)] bg-[var(--red-dim)]'
    : status === 'yellow' ? 'border-[var(--amber)] bg-[var(--amber-dim)]'
    : status === 'green' ? 'border-emerald-200 bg-emerald-50'
    : accent ? 'border-[#0026c0]/20 bg-[var(--blue-dim)]'
    : 'border-[var(--border)] bg-[var(--surface)]'
  const valCls = status === 'red' ? 'text-[var(--red)]'
    : status === 'yellow' ? 'text-[var(--amber)]'
    : status === 'green' ? 'text-emerald-600'
    : accent ? 'text-[#0026c0]' : 'text-[var(--text-bright)]'
  return (
    <div className={cn('rounded-[10px] border p-4', borderCls)}>
      <div className={cn('text-xl font-semibold', valCls)}>{value}</div>
      <div className="text-xs text-[var(--text-muted)] mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{sub}</div>}
    </div>
  )
}

export function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[var(--text-muted)]">{icon}</span>
      <h2 className="text-sm font-semibold text-[var(--text-body)]">{title}</h2>
    </div>
  )
}

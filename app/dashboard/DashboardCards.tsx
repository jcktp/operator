import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub: string
  color: 'green' | 'red' | 'amber' | 'gray'
}) {
  const colors = {
    green: 'bg-green-50 dark:bg-green-950 border-green-100 dark:border-green-900 text-green-700 dark:text-green-300',
    red:   'bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-900 text-red-700 dark:text-red-300',
    amber: 'bg-amber-50 dark:bg-amber-950 border-amber-100 dark:border-amber-900 text-amber-700 dark:text-amber-300',
    gray:  'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-50',
  }
  return (
    <div className={cn('border rounded-xl p-4', colors[color])}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-60 mt-0.5">{sub}</p>
    </div>
  )
}

export function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up')   return <TrendingUp size={14} className="text-green-500" />
  if (trend === 'down') return <TrendingDown size={14} className="text-red-500" />
  return <Minus size={14} className="text-gray-300" />
}

export function HealthBar({ score }: { score: number }) {
  const color = score >= 60 ? 'bg-green-500' : score >= 40 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-gray-400 dark:text-zinc-500 tabular-nums">{score}%</span>
    </div>
  )
}

import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export function StatCard({ label, value, sub, color }: {
 label: string; value: string; sub: string
 color: 'green' | 'red' | 'amber' | 'gray'
}) {
 const colors = {
 green: 'bg-[var(--green-dim)] border-green-100 text-[var(--green)]',
 red: 'bg-[var(--red-dim)] border-red-100 text-[var(--red)]',
 amber: 'bg-[var(--amber-dim)] border-amber-100 text-[var(--amber)]',
 gray: 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-bright)]',
 }
 return (
 <div className={cn('border rounded-[10px] p-4', colors[color])}>
 <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
 <p className="text-2xl font-bold">{value}</p>
 <p className="text-xs opacity-60 mt-0.5">{sub}</p>
 </div>
 )
}

export function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
 if (trend === 'up') return <TrendingUp size={14} className="text-[var(--green)]" />
 if (trend === 'down') return <TrendingDown size={14} className="text-[var(--red)]" />
 return <Minus size={14} className="text-[var(--border)]" />
}

export function HealthBar({ score }: { score: number }) {
 const color = score >= 60 ? 'bg-green-500' : score >= 40 ? 'bg-amber-400' : 'bg-red-400'
 return (
 <div className="flex items-center gap-1.5">
 <div className="w-16 h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
 <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
 </div>
 <span className="text-xs text-[var(--text-muted)] tabular-nums">{score}%</span>
 </div>
 )
}

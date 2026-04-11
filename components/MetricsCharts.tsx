'use client'

import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'

export interface MetricPoint {
  date: string
  displayValue: string
  numericValue: number | null
  status?: string
}

export interface MetricSeries {
  label: string
  points: MetricPoint[]
}

export interface AreaMetricData {
  area: string
  metrics: MetricSeries[]
}

function parseNumeric(value: string): number | null {
  if (!value) return null
  let s = value.trim()
  // Remove currency symbols
  s = s.replace(/[£$€¥₹]/g, '')
  // Remove commas
  s = s.replace(/,/g, '')
  // Remove % sign (keep numeric value)
  s = s.replace(/%$/, '')
  // Handle K/M/B suffixes
  const multipliers: Record<string, number> = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }
  const suffixMatch = s.match(/^([-\d.]+)\s*([kmb])$/i)
  if (suffixMatch) {
    const num = parseFloat(suffixMatch[1])
    const mult = multipliers[suffixMatch[2].toLowerCase()] ?? 1
    return isNaN(num) ? null : num * mult
  }
  // Try plain number (may have trailing units like "days")
  const numMatch = s.match(/^([-\d.]+)/)
  if (numMatch) {
    const n = parseFloat(numMatch[1])
    return isNaN(n) ? null : n
  }
  return null
}

function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  if (n % 1 !== 0) return n.toFixed(1)
  return String(n)
}

const STATUS_COLORS: Record<string, string> = {
  positive: '#16a34a',
  negative: '#dc2626',
  warning: '#d97706',
  neutral: '#6b7280',
}

function DeltaBadge({ current, previous, status }: { current: number; previous: number; status?: string }) {
  const diff = current - previous
  const pct = previous !== 0 ? (diff / Math.abs(previous)) * 100 : 0
  const isPositive = diff > 0
  const isNeutral = diff === 0

  // Determine colour: use status if available, else direction
  let color = '#6b7280'
  if (status === 'positive') color = '#16a34a'
  else if (status === 'negative') color = '#dc2626'
  else if (status === 'warning') color = '#d97706'
  else if (isNeutral) color = '#6b7280'
  else if (isPositive) color = '#16a34a'
  else color = '#dc2626'

  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium" style={{ color }}>
      {isNeutral ? <Minus size={10} /> : isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {isNeutral ? '—' : `${isPositive ? '+' : ''}${pct.toFixed(1)}%`}
    </span>
  )
}

function MetricCard({ series }: { series: MetricSeries }) {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  const numericPoints = series.points.map(p => ({
    ...p,
    n: p.numericValue,
    shortDate: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  const hasNumeric = numericPoints.some(p => p.n !== null)

  // Latest and previous values
  const latest = numericPoints[numericPoints.length - 1]
  const prev = numericPoints[numericPoints.length - 2]
  const latestStatus = latest?.status

  const chartData = hasNumeric
    ? numericPoints.filter(p => p.n !== null).map(p => ({ date: p.shortDate, value: p.n as number, label: p.displayValue }))
    : []

  const useLineChart = chartData.length >= 3
  const color = latestStatus ? STATUS_COLORS[latestStatus] ?? '#6b7280' : '#3b82f6'

  const gridStroke   = dark ? '#3f3f46' : '#f3f4f6'
  const tickFill     = dark ? '#71717a' : '#9ca3af'
  const tooltipStyle = dark
    ? { fontSize: 11, borderRadius: 8, border: '1px solid #3f3f46', padding: '4px 8px', backgroundColor: '#18181b', color: '#e4e4e7' }
    : { fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', padding: '4px 8px', backgroundColor: '#ffffff', color: '#111827' }
  const labelStyle   = { color: dark ? '#a1a1aa' : '#6b7280' }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-[10px] p-4">
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs font-medium text-gray-600 dark:text-zinc-400 truncate max-w-[70%]">{series.label}</p>
        {latest && prev && latest.n !== null && prev.n !== null && (
          <DeltaBadge current={latest.n} previous={prev.n} status={latestStatus} />
        )}
      </div>

      {latest && (
        <p className="text-xl font-semibold text-gray-900 dark:text-zinc-50 mb-2" style={{ color: latestStatus ? STATUS_COLORS[latestStatus] : undefined }}>
          {latest.displayValue}
        </p>
      )}

      {hasNumeric && chartData.length >= 2 && (
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            {useLineChart ? (
              <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: tickFill }} tickLine={false} axisLine={false} />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(_v: any, _n: any, props: any) => [props.payload?.label ?? formatCompact(_v as number), '']}
                />
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: tickFill }} tickLine={false} axisLine={false} />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(_v: any, _n: any, props: any) => [props.payload?.label ?? formatCompact(_v as number), '']}
                />
                <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {!hasNumeric && (
        <div className="space-y-1">
          {series.points.slice(-3).reverse().map((p, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-gray-400 dark:text-zinc-500">{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              <span className={`font-medium ${
                p.status === 'positive' ? 'text-green-600 dark:text-green-400'
                  : p.status === 'negative' ? 'text-red-600 dark:text-red-400'
                  : p.status === 'warning' ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-700 dark:text-zinc-300'
              }`}>{p.displayValue}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AreaMetricsSection({ area }: { area: AreaMetricData }) {
  const charted = area.metrics.filter(m => m.points.length >= 2)
  if (charted.length === 0) return null

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">{area.area}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {charted.map(m => <MetricCard key={m.label} series={m} />)}
      </div>
    </div>
  )
}

export function MetricsChartsSection({ areas }: { areas: AreaMetricData[] }) {
  const visible = areas.filter(a => a.metrics.some(m => m.points.length >= 2))
  if (visible.length === 0) return null

  return (
    <section className="space-y-6">
      <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Metric Trends</h2>
      {visible.map(a => <AreaMetricsSection key={a.area} area={a} />)}
    </section>
  )
}

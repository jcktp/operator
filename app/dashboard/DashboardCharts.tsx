'use client'

import {
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
 ResponsiveContainer, Cell, AreaChart, Area, Legend,
} from 'recharts'

export interface AreaHealthDatum { area: string; health: number }
export interface TimelineDatum { date: string; count: number }
export interface InsightTypeDatum { type: string; count: number; color: string }
export interface MetricAreaDatum { area: string; positive: number; negative: number; warning: number; neutral: number }

interface Props {
 areaHealth: AreaHealthDatum[]
 reportsOverTime: TimelineDatum[]
 flagsByType: InsightTypeDatum[]
 metricsByArea: MetricAreaDatum[]
}

const CHART_HEIGHT = 220

function healthColor(h: number) {
 return h >= 60 ? '#22c55e' : h >= 40 ? '#f59e0b' : '#ef4444'
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
 return (
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5">
 <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">{title}</p>
 {children}
 </div>
 )
}

// Truncate long area names for Y-axis
function shortLabel(s: string) {
 return s.length > 12 ? s.slice(0, 11) + '…' : s
}

export default function DashboardCharts({ areaHealth, reportsOverTime, flagsByType, metricsByArea }: Props) {
 return (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

 {/* 1. Area health */}
 <ChartCard title="Area health">
 {areaHealth.length === 0 ? (
 <Empty />
 ) : (
 <ResponsiveContainer width="100%" height={Math.max(CHART_HEIGHT, areaHealth.length * 36)}>
 <BarChart layout="vertical" data={areaHealth} margin={{ left: 4, right: 24, top: 0, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
 <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
 <YAxis type="category" dataKey="area" width={80} tickFormatter={shortLabel} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
 <Tooltip
 formatter={(v) => [typeof v === 'number' ? `${v}%` : v, 'Health']}
 contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
 />
 <Bar dataKey="health" radius={[0, 4, 4, 0]} maxBarSize={22}>
 {areaHealth.map((d, i) => <Cell key={i} fill={healthColor(d.health)} />)}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 )}
 </ChartCard>

 {/* 2. Reports over time */}
 <ChartCard title="Reports over time">
 {reportsOverTime.length < 2 ? (
 <Empty label="Not enough data yet" />
 ) : (
 <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
 <AreaChart data={reportsOverTime} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
 <defs>
 <linearGradient id="reportGrad" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
 <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
 <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
 <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={24} />
 <Tooltip
 contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
 labelFormatter={l => `Date: ${l}`}
 />
 <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#reportGrad)" name="Reports" dot={false} activeDot={{ r: 4 }} />
 </AreaChart>
 </ResponsiveContainer>
 )}
 </ChartCard>

 {/* 3. Insight types */}
 <ChartCard title="Insights breakdown">
 {flagsByType.length === 0 ? (
 <Empty label="No insights yet" />
 ) : (
 <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
 <BarChart data={flagsByType} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
 <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
 <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={24} />
 <Tooltip
 contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
 />
 <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48} name="Count">
 {flagsByType.map((d, i) => <Cell key={i} fill={d.color} />)}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 )}
 </ChartCard>

 {/* 4. Metric distribution per area */}
 <ChartCard title="Metric status by area">
 {metricsByArea.length === 0 ? (
 <Empty />
 ) : (
 <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
 <BarChart data={metricsByArea} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
 <XAxis dataKey="area" tickFormatter={shortLabel} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
 <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={24} />
 <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
 <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
 <Bar dataKey="positive" stackId="a" fill="#22c55e" name="Positive" radius={[0, 0, 0, 0]} maxBarSize={40} />
 <Bar dataKey="warning" stackId="a" fill="#f59e0b" name="Warning" maxBarSize={40} />
 <Bar dataKey="negative" stackId="a" fill="#ef4444" name="Negative" maxBarSize={40} />
 <Bar dataKey="neutral" stackId="a" fill="#e5e7eb" name="Neutral" radius={[4, 4, 0, 0]} maxBarSize={40} />
 </BarChart>
 </ResponsiveContainer>
 )}
 </ChartCard>

 </div>
 )
}

function Empty({ label = 'No data' }: { label?: string }) {
 return (
 <div className="flex items-center justify-center h-[220px] text-[var(--border)] text-sm">{label}</div>
 )
}

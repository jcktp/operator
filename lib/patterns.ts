/**
 * Pattern detection across multiple reports.
 * Used by both the Catch Me Up digest and the Dispatch context builder.
 */

import { parseJsonSafe } from '@/lib/utils'
import type { Metric, Insight, Question } from '@/lib/utils'

interface ReportForPatterns {
  area: string
  title: string
  reportDate: string | null   // ISO string or null
  createdAt: string           // ISO string
  summary: string | null
  metrics: string | null
  insights: string | null
  questions: string | null
}

interface MetricTrend {
  area: string
  label: string
  direction: 'up' | 'down' | 'flat'
  changeStr: string           // e.g. "+12% over 4 reports"
  values: string[]            // last few display values oldest→newest
}

interface RecurringFlag {
  area: string
  type: string
  count: number
  examples: string[]          // up to 2 representative texts
}

interface RecurringQuestion {
  theme: string               // representative question text
  count: number
  areas: string[]
}

export interface PatternSummary {
  metricTrends: MetricTrend[]
  recurringFlags: RecurringFlag[]
  recurringQuestions: RecurringQuestion[]
  stalledAreas: string[]      // areas with no report in >21 days
  hotAreas: string[]          // areas with 3+ reports in last 14 days
}

// ── helpers ──────────────────────────────────────────────────────────────────

function parseNumeric(v: string): number | null {
  const s = v.trim().replace(/[£$€¥₹,]/g, '').replace(/%$/, '')
  const suffix = s.match(/^([-\d.]+)\s*([kmb])$/i)
  if (suffix) {
    const n = parseFloat(suffix[1])
    const m = ({ k: 1e3, m: 1e6, b: 1e9 } as Record<string, number>)[suffix[2].toLowerCase()] ?? 1
    return isNaN(n) ? null : n * m
  }
  const plain = s.match(/^([-\d.]+)/)
  if (plain) { const n = parseFloat(plain[1]); return isNaN(n) ? null : n }
  return null
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

/** Simple word-overlap similarity — enough to cluster near-duplicate flags/questions */
function similarity(a: string, b: string): number {
  const wa = new Set(normalise(a).split(' ').filter(w => w.length > 3))
  const wb = new Set(normalise(b).split(' ').filter(w => w.length > 3))
  if (wa.size === 0 || wb.size === 0) return 0
  let overlap = 0
  for (const w of wa) if (wb.has(w)) overlap++
  return overlap / Math.max(wa.size, wb.size)
}

// ── main export ───────────────────────────────────────────────────────────────

export function buildPatternSummary(reports: ReportForPatterns[]): PatternSummary {
  const now = Date.now()
  const DAY = 86_400_000

  // Sort oldest → newest for trend direction
  const sorted = [...reports].sort((a, b) =>
    new Date(a.reportDate ?? a.createdAt).getTime() - new Date(b.reportDate ?? b.createdAt).getTime()
  )

  // ── Metric trends ─────────────────────────────────────────────────────────
  // group by area + normalised label → collect numeric points
  const metricSeries: Record<string, { area: string; label: string; points: Array<{ n: number; display: string }> }> = {}
  for (const r of sorted) {
    for (const m of parseJsonSafe<Metric[]>(r.metrics, [])) {
      const n = parseNumeric(m.value)
      if (n === null) continue
      const key = `${r.area}::${normalise(m.label)}`
      if (!metricSeries[key]) metricSeries[key] = { area: r.area, label: m.label.trim(), points: [] }
      metricSeries[key].points.push({ n, display: m.value })
    }
  }

  const metricTrends: MetricTrend[] = []
  for (const series of Object.values(metricSeries)) {
    if (series.points.length < 2) continue
    const pts = series.points
    const first = pts[0].n
    const last = pts[pts.length - 1].n
    const pctChange = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0
    const direction: 'up' | 'down' | 'flat' =
      Math.abs(pctChange) < 2 ? 'flat' : pctChange > 0 ? 'up' : 'down'
    const sign = direction === 'up' ? '+' : direction === 'down' ? '' : '±'
    const changeStr = `${sign}${pctChange.toFixed(1)}% over ${pts.length} ${pts.length === 1 ? 'report' : 'reports'}`
    metricTrends.push({
      area: series.area,
      label: series.label,
      direction,
      changeStr,
      values: pts.slice(-4).map(p => p.display),
    })
  }
  // Surface the most significant trends first (largest absolute change)
  metricTrends.sort((a, b) => {
    const pctA = parseFloat(a.changeStr.replace(/[^-\d.]/g, ''))
    const pctB = parseFloat(b.changeStr.replace(/[^-\d.]/g, ''))
    return Math.abs(pctB) - Math.abs(pctA)
  })

  // ── Recurring flags ───────────────────────────────────────────────────────
  // Collect all risk/anomaly insights, cluster near-duplicates per area
  type RawFlag = { area: string; type: string; text: string }
  const rawFlags: RawFlag[] = []
  for (const r of sorted) {
    for (const i of parseJsonSafe<Insight[]>(r.insights, [])) {
      if (i.type === 'risk' || i.type === 'anomaly') {
        rawFlags.push({ area: r.area, type: i.type, text: i.text })
      }
    }
  }

  // Group by area, then cluster similar texts
  const flagsByArea: Record<string, RawFlag[]> = {}
  for (const f of rawFlags) {
    if (!flagsByArea[f.area]) flagsByArea[f.area] = []
    flagsByArea[f.area].push(f)
  }

  const recurringFlags: RecurringFlag[] = []
  for (const [area, flags] of Object.entries(flagsByArea)) {
    // Cluster by similarity
    const clusters: RawFlag[][] = []
    for (const f of flags) {
      const match = clusters.find(c => similarity(c[0].text, f.text) >= 0.35)
      if (match) match.push(f)
      else clusters.push([f])
    }
    for (const cluster of clusters) {
      if (cluster.length < 2) continue
      recurringFlags.push({
        area,
        type: cluster[0].type,
        count: cluster.length,
        examples: [...new Set(cluster.map(f => f.text))].slice(0, 2),
      })
    }
  }
  recurringFlags.sort((a, b) => b.count - a.count)

  // ── Recurring questions ───────────────────────────────────────────────────
  type RawQ = { area: string; text: string }
  const rawQs: RawQ[] = []
  for (const r of sorted) {
    for (const q of parseJsonSafe<Question[]>(r.questions, [])) {
      if (q.priority === 'high') rawQs.push({ area: r.area, text: q.text })
    }
  }

  const qClusters: Array<{ texts: string[]; areas: string[] }> = []
  for (const q of rawQs) {
    const match = qClusters.find(c => similarity(c.texts[0], q.text) >= 0.35)
    if (match) { match.texts.push(q.text); if (!match.areas.includes(q.area)) match.areas.push(q.area) }
    else qClusters.push({ texts: [q.text], areas: [q.area] })
  }

  const recurringQuestions: RecurringQuestion[] = qClusters
    .filter(c => c.texts.length >= 2)
    .map(c => ({ theme: c.texts[0], count: c.texts.length, areas: c.areas }))
    .sort((a, b) => b.count - a.count)

  // ── Stalled / hot areas ───────────────────────────────────────────────────
  const latestByArea: Record<string, number> = {}
  const recentCountByArea: Record<string, number> = {}
  for (const r of sorted) {
    const ts = new Date(r.reportDate ?? r.createdAt).getTime()
    if (!latestByArea[r.area] || ts > latestByArea[r.area]) latestByArea[r.area] = ts
    if (now - ts < 14 * DAY) recentCountByArea[r.area] = (recentCountByArea[r.area] ?? 0) + 1
  }

  const stalledAreas = Object.entries(latestByArea)
    .filter(([, ts]) => now - ts > 21 * DAY)
    .map(([area]) => area)
    .sort()

  const hotAreas = Object.entries(recentCountByArea)
    .filter(([, count]) => count >= 3)
    .map(([area]) => area)
    .sort()

  return { metricTrends, recurringFlags, recurringQuestions, stalledAreas, hotAreas }
}

/** Renders the pattern summary as a plain-text block for injection into AI prompts. */
export function formatPatternSummary(p: PatternSummary, docLabel = 'report'): string {
  const lines: string[] = []

  if (p.metricTrends.length > 0) {
    lines.push('METRIC TRENDS (tracked across multiple ' + docLabel + 's):')
    for (const t of p.metricTrends.slice(0, 10)) {
      const arrow = t.direction === 'up' ? '↑' : t.direction === 'down' ? '↓' : '→'
      lines.push(`  ${arrow} [${t.area}] ${t.label}: ${t.changeStr} (${t.values.join(' → ')})`)
    }
  }

  if (p.recurringFlags.length > 0) {
    lines.push('')
    lines.push('RECURRING FLAGS (same issue raised in multiple ' + docLabel + 's):')
    for (const f of p.recurringFlags.slice(0, 8)) {
      lines.push(`  ⚠ [${f.area}] "${f.examples[0]}" — flagged ${f.count}x`)
      if (f.examples[1]) lines.push(`    (also: "${f.examples[1]}")`)
    }
  }

  if (p.recurringQuestions.length > 0) {
    lines.push('')
    lines.push('UNRESOLVED RECURRING QUESTIONS:')
    for (const q of p.recurringQuestions.slice(0, 6)) {
      lines.push(`  ? "${q.theme}" — raised ${q.count}x across: ${q.areas.join(', ')}`)
    }
  }

  if (p.stalledAreas.length > 0) {
    lines.push('')
    lines.push(`NO RECENT ACTIVITY (>21 days): ${p.stalledAreas.join(', ')}`)
  }

  if (p.hotAreas.length > 0) {
    lines.push('')
    lines.push(`HIGH ACTIVITY AREAS (3+ ${docLabel}s in last 14 days): ${p.hotAreas.join(', ')}`)
  }

  return lines.join('\n')
}

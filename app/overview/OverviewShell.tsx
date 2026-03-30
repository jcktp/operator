'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { AreaBadge, InsightTypeBadge, StatusBadge } from '@/components/Badge'
import { ArrowRight, Upload, AlertTriangle, HelpCircle, MessageSquare, CheckCircle2, FileStack, Loader2, X, Sparkles } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useDispatch } from '@/components/DispatchContext'
import { useMode } from '@/components/ModeContext'
import { getReportLabels } from '@/lib/mode-labels'
import { MetricsChartsSection } from '@/components/MetricsCharts'
import type { AreaMetricData } from '@/components/MetricsCharts'
import PeriodDropdown from '@/components/PeriodDropdown'

// ── Serialised data shapes ───────────────────────────────────────────────────

export interface SerializedAreaReport {
  id: string
  area: string
  title: string
  summary: string | null
  metrics: Array<{ label: string; value: string; status?: string }>
  createdAt: string
}

export interface FlagItem {
  text: string; type: string; reportTitle: string; reportId: string
}

export interface QuestionItem {
  text: string; reportTitle: string; directName?: string; reportId: string
}

export interface ResolvedFlagItem {
  text: string; area: string; reportId: string
}

export interface RecentReport {
  id: string; title: string; area: string; createdAt: string
  directName?: string; directTitle?: string
}

export interface OverviewData {
  stats: { totalReports: number; areasCount: number; directsCount: number }
  areas: Array<{ name: string; count: number }>
  selectedArea?: string
  activeAreas: SerializedAreaReport[]
  topInsights: FlagItem[]
  topQuestions: QuestionItem[]
  resolvedFlagItems: ResolvedFlagItem[]
  recentReports: RecentReport[]
  context: string
  areaMetrics?: AreaMetricData[]
}

// ── Shell ────────────────────────────────────────────────────────────────────

export default function OverviewShell({ data, activeFrom, activeTo }: { data: OverviewData; activeFrom?: string; activeTo?: string }) {
  const { open: dispatchOpen, setOpen: setDispatchOpen, setAiContext } = useDispatch()
  const mode = useMode()
  const labels = getReportLabels(mode.id)
  const { stats, areas, selectedArea, activeAreas, topInsights, topQuestions, resolvedFlagItems, recentReports, context, areaMetrics } = data

  function areaHref(area?: string) {
    const p = new URLSearchParams()
    if (area) p.set('area', area)
    if (activeFrom) p.set('from', activeFrom)
    if (activeTo) p.set('to', activeTo)
    const q = p.toString()
    return q ? `/?${q}` : '/'
  }

  const scrollYRef = useRef(0)
  const [catchMeUpOpen, setCatchMeUpOpen] = useState(false)
  const [catchMeUpLoading, setCatchMeUpLoading] = useState(false)
  const [catchMeUpText, setCatchMeUpText] = useState<string | null>(null)

  useEffect(() => {
    setAiContext(context)
  }, [context, setAiContext])

  const handleCatchMeUp = async () => {
    setCatchMeUpOpen(true)
    if (catchMeUpText) return
    setCatchMeUpLoading(true)
    try {
      const res = await fetch('/api/catch-me-up')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { digest: string }
      setCatchMeUpText(data.digest ?? 'No digest returned.')
    } catch {
      setCatchMeUpText('Unable to generate digest. Check your AI provider settings.')
    } finally {
      setCatchMeUpLoading(false)
    }
  }

  return (
    <div className="space-y-8">

      {/* Header — full width, unaffected by sidebar */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">Overview</h1>
          <p className="text-gray-500 dark:text-zinc-400 text-sm mt-0.5">
            {stats.totalReports} {stats.totalReports !== 1 ? mode.documentLabelPlural.toLowerCase() : mode.documentLabel.toLowerCase()} across {stats.areasCount} {stats.areasCount !== 1 ? mode.collectionLabelPlural.toLowerCase() : mode.collectionLabel.toLowerCase()}
            {stats.directsCount > 0 && ` · ${stats.directsCount} ${stats.directsCount !== 1 ? mode.personLabelPlural.toLowerCase() : mode.personLabel.toLowerCase()}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodDropdown activeFrom={activeFrom} activeTo={activeTo} basePath="/" />
          <button
            onClick={handleCatchMeUp}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 hover:border-gray-300 dark:hover:border-zinc-600 hover:text-gray-900 dark:hover:text-zinc-50 transition-colors"
          >
            <Sparkles size={13} />
            Catch me up
          </button>
          <Link
            href="/?tab=one-pager"
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 hover:border-gray-300 dark:hover:border-zinc-600 hover:text-gray-900 dark:hover:text-zinc-50 transition-colors"
          >
            <FileStack size={13} />
            One Pager
          </Link>
          <button
            onClick={() => { scrollYRef.current = window.scrollY; setDispatchOpen(!dispatchOpen); requestAnimationFrame(() => window.scrollTo(0, scrollYRef.current)) }}
            className={cn(
              'inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors',
              dispatchOpen
                ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-gray-900 dark:border-zinc-100'
                : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-200 border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 hover:text-gray-900 dark:hover:text-zinc-50'
            )}
          >
            <MessageSquare size={13} />
            Dispatch
          </button>
          <Link
            href="/upload"
            className="inline-flex items-center gap-1.5 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors"
          >
            <Upload size={14} />
            {mode.navDocuments}
          </Link>
        </div>
      </div>

      {/* Catch Me Up panel — full width */}
      {catchMeUpOpen && (
        <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 relative">
          <button
            onClick={() => setCatchMeUpOpen(false)}
            className="absolute top-3 right-3 p-1 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
          >
            <X size={14} />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={13} className="text-gray-500 dark:text-zinc-400" />
            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Catch me up</span>
          </div>
          {catchMeUpLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-zinc-500 py-4">
              <Loader2 size={14} className="animate-spin" />
              Generating digest…
            </div>
          ) : (
            <p className="text-sm text-gray-700 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">{catchMeUpText}</p>
          )}
        </div>
      )}

      {/* Sidebar + content */}
      <div className="flex gap-6 items-start">

        {/* Sidebar — area filter */}
        {areas.length > 1 && (
          <aside className="w-44 shrink-0 space-y-1 sticky top-24">
            <Link
              href={areaHref()}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                !selectedArea ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium' : 'text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
              )}
            >
              <span>All areas</span>
              <span className={cn('text-xs shrink-0', !selectedArea ? 'text-gray-300 dark:text-zinc-600' : 'text-gray-400 dark:text-zinc-500')}>
                {areas.reduce((s, a) => s + a.count, 0)}
              </span>
            </Link>
            {areas.map(a => (
              <Link
                key={a.name}
                href={areaHref(a.name)}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                  selectedArea === a.name ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium' : 'text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                )}
              >
                <span className="truncate">{a.name}</span>
                <span className={cn('text-xs shrink-0', selectedArea === a.name ? 'text-gray-300 dark:text-zinc-600' : 'text-gray-400 dark:text-zinc-500')}>
                  {a.count}
                </span>
              </Link>
            ))}
          </aside>
        )}

        <div className="flex-1 min-w-0 space-y-8">
          {/* Areas */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
              {selectedArea ?? `By ${mode.collectionLabel}`}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeAreas.map(report => (
                <Link
                  key={report.id}
                  href={`/reports/${report.id}`}
                  className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-4 hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <AreaBadge area={report.area} />
                    <span className="text-xs text-gray-400 dark:text-zinc-500">{formatRelativeDate(new Date(report.createdAt))}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-zinc-200 line-clamp-2 mb-3">{report.summary || report.title}</p>
                  {report.metrics.length > 0 && (
                    <div className="space-y-1.5 border-t border-gray-100 dark:border-zinc-800 pt-3">
                      {report.metrics.slice(0, 3).map((m, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-zinc-400 truncate max-w-[60%]">{m.label}</span>
                          <div className="flex items-center gap-1">
                            {m.status && m.status !== 'neutral' && (
                              <StatusBadge status={m.status as 'positive' | 'negative' | 'warning'} />
                            )}
                            <span className="text-xs font-medium text-gray-900 dark:text-zinc-50">{m.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-300 transition-colors">
                    <span>View {mode.documentLabel.toLowerCase()}</span><ArrowRight size={11} />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Resolved flags */}
          {resolvedFlagItems.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <CheckCircle2 size={11} className="text-green-500" />
                {labels.resolvedPanel}
              </h2>
              <div className="bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-800 rounded-xl divide-y divide-green-100 dark:divide-green-800">
                {resolvedFlagItems.map((f, i) => (
                  <Link
                    key={i}
                    href={`/reports/${f.reportId}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-green-100/50 dark:hover:bg-green-900/50 transition-colors"
                  >
                    <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-green-800 dark:text-green-300">{f.text}</p>
                      <AreaBadge area={f.area} />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Metric trends charts */}
          {areaMetrics && areaMetrics.length > 0 && (
            <MetricsChartsSection areas={areaMetrics} />
          )}

          {/* Flags + Questions */}
          {(topInsights.length > 0 || topQuestions.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {topInsights.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <AlertTriangle size={11} /> {labels.flagsPanel}
                  </h2>
                  <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl divide-y divide-gray-100 dark:divide-zinc-800">
                    {topInsights.map((insight, i) => (
                      <Link key={i} href={`/reports/${insight.reportId}`}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                        <div className="w-24 shrink-0">
                          <InsightTypeBadge type={insight.type as 'risk' | 'anomaly' | 'observation' | 'opportunity'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 dark:text-zinc-200">{insight.text}</p>
                          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{insight.reportTitle}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
              {topQuestions.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <HelpCircle size={11} /> {labels.questionsPanel}
                  </h2>
                  <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl divide-y divide-gray-100 dark:divide-zinc-800">
                    {topQuestions.map((q, i) => (
                      <Link key={i} href={`/reports/${q.reportId}`}
                        className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                        <p className="text-sm text-gray-800 dark:text-zinc-100 font-medium">{q.text}</p>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                          {q.directName ? `${labels.questionsPersonPrefix} ${q.directName}` : q.reportTitle}
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Recent reports */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Recent {mode.documentLabelPlural}</h2>
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl divide-y divide-gray-100 dark:divide-zinc-800">
              {recentReports.map(report => (
                <Link key={report.id} href={`/reports/${report.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-zinc-50 truncate">{report.title}</span>
                      <AreaBadge area={report.area} />
                    </div>
                    {report.directName && (
                      <p className="text-xs text-gray-400 dark:text-zinc-500">{report.directName} · {report.directTitle}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400 dark:text-zinc-500">{formatRelativeDate(new Date(report.createdAt))}</span>
                    <ArrowRight size={14} className="text-gray-300 dark:text-zinc-600" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

      </div>
    </div>
  )
}

import { Upload, MessageSquare, BookOpen, Globe, Rss, Network, Clock, BarChart2, BookMarked, FolderOpen } from 'lucide-react'
import type { ModeConfig } from '@/lib/mode'

interface Props {
  modeConfig: ModeConfig
  onNext: () => void
  onBack: () => void
}

interface Card { icon: React.ReactNode; title: string; desc: string }

export default function StepTour({ modeConfig, onNext, onBack }: Props) {
  const c = modeConfig
  const f = c.features

  const universal: Card[] = [
    { icon: <FolderOpen size={17} className="text-indigo-500" />,   title: 'Projects',     desc: 'Organise work into named projects. All documents, analysis, and dispatch are scoped to the active project.' },
    { icon: <Upload size={17} className="text-indigo-400" />,       title: c.navLibrary,   desc: `Upload ${c.documentLabelPlural.toLowerCase()} and get automatic AI summaries, flags, and insights.` },
    { icon: <MessageSquare size={17} className="text-violet-500" />, title: 'Dispatch',    desc: `AI assistant. Ask anything about your ${c.documentLabelPlural.toLowerCase()}, get cross-references, draft outputs.` },
    { icon: <BookOpen size={17} className="text-amber-500" />,      title: c.navJournal,   desc: 'Private notes with AI rewrite and catch-me-up. Organised by folder.' },
    { icon: <Globe size={17} className="text-sky-500" />,           title: 'Browser',      desc: 'In-app browser with Reader mode. Import articles directly to your Library.' },
    { icon: <Rss size={17} className="text-emerald-500" />,         title: 'Pulse',        desc: 'RSS feeds for sources you follow. Save items to your Library in one click.' },
  ]

  const modeSpecific: Card[] = []
  if (f.entities)          modeSpecific.push({ icon: <Network size={17} className="text-rose-500" />,    title: c.features.extraNavItems[0]?.label ?? 'Entities',  desc: `Named people, organisations, and places auto-extracted across your ${c.documentLabelPlural.toLowerCase()}.` })
  if (f.timeline)          modeSpecific.push({ icon: <Clock size={17} className="text-orange-500" />,    title: 'Timeline',          desc: `Events assembled into a chronological view from your ${c.documentLabelPlural.toLowerCase()}.` })
  if (f.metricsBoard)      modeSpecific.push({ icon: <BarChart2 size={17} className="text-teal-500" />,  title: 'Metrics',           desc: `Aggregated KPI tracking and time-series charts across your ${c.documentLabelPlural.toLowerCase()}.` })
  if (f.keywordMonitoring) modeSpecific.push({ icon: <BookMarked size={17} className="text-fuchsia-500" />, title: 'Keyword monitoring', desc: 'Track keywords across Pulse — highlighted whenever they appear in new items.' })

  const cards = [...universal, ...modeSpecific]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-50 mb-1">What you have access to</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400">Everything is in the left navigation. Here&apos;s a quick overview.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map(card => (
          <div key={card.title} className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              {card.icon}
              <span className="text-sm font-medium text-gray-800 dark:text-zinc-100">{card.title}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">{card.desc}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
          ← Back
        </button>
        <button onClick={onNext} className="flex-[3] py-3 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-xl hover:bg-gray-700 dark:hover:bg-zinc-200 transition-colors">
          Continue →
        </button>
      </div>
    </div>
  )
}

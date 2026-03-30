import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getModeConfig } from '@/lib/mode'
import { Users, Clock, Map, BookOpen } from 'lucide-react'
import EntitiesTab from './tabs/EntitiesTab'
import TimelineTab from './tabs/TimelineTab'
import StoryMapTab from './tabs/StoryMapTab'
import StorylineTab from './tabs/StorylineTab'

export const dynamic = 'force-dynamic'

const TAB_ICONS: Record<string, React.ReactNode> = {
  entities:    <Users size={13} />,
  timeline:    <Clock size={12} />,
  'story-map': <Map size={13} />,
  storyline:   <BookOpen size={13} />,
}

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string; sort?: string }>
}) {
  const { tab = 'entities', type: selectedType, sort = 'frequency' } = await searchParams

  const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  const modeConfig = getModeConfig(modeRow?.value)
  if (!modeConfig.features.entities) notFound()

  const navItem = modeConfig.features.extraNavItems.find(i => i.href === '/entities')
  const pageTitle = navItem?.label ?? 'Investigation Hub'

  const tabs = [
    { id: 'entities',    label: navItem?.label ?? 'Entities' },
    ...(modeConfig.features.timeline ? [{ id: 'timeline', label: 'Timeline' }] : []),
    { id: 'story-map',  label: 'Story Map' },
    { id: 'storyline',  label: 'Storyline' },
  ]

  const activeTab = tabs.find(t => t.id === tab)?.id ?? 'entities'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50 flex items-center gap-2">
          <Users size={20} />
          {pageTitle}
        </h1>
        <p className="text-gray-500 dark:text-zinc-400 text-sm mt-0.5">
          Entities, timeline, map, and story tools across your {modeConfig.navLibrary.toLowerCase()}.
        </p>

        {/* Tab nav */}
        <div className="flex gap-1 mt-5 border-b border-gray-200 dark:border-zinc-700">
          {tabs.map(t => {
            const isActive = t.id === activeTab
            return (
              <Link
                key={t.id}
                href={`/entities?tab=${t.id}`}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  isActive
                    ? 'border-gray-900 dark:border-zinc-100 text-gray-900 dark:text-zinc-50'
                    : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:border-gray-300 dark:hover:border-zinc-600'
                }`}
              >
                {TAB_ICONS[t.id]}
                {t.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'entities' && (
        <EntitiesTab selectedType={selectedType} sort={sort} modeConfig={modeConfig} />
      )}

      {activeTab === 'timeline' && modeConfig.features.timeline && (
        <TimelineTab modeConfig={modeConfig} />
      )}

      {activeTab === 'story-map' && (
        <StoryMapTab />
      )}

      {activeTab === 'storyline' && (
        <StorylineTab />
      )}
    </div>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getModeConfig } from '@/lib/mode'
import { Users, Clock, Map, BookOpen, Globe } from 'lucide-react'
import EntitiesTab from './tabs/EntitiesTab'
import TimelineTab from './tabs/TimelineTab'
import StoryMapTab from './tabs/StoryMapTab'
import StorylineTab from './tabs/StorylineTab'
import OsintTab from './tabs/OsintTab'
import InspectorSidebar from '@/components/InspectorSidebar'
import EntitiesSearchBar from './EntitiesSearchBar'
import { EntitiesSearchProvider } from './EntitiesSearchContext'

export const dynamic = 'force-dynamic'

const TAB_ICONS: Record<string, React.ReactNode> = {
  entities:    <Users size={13} />,
  timeline:    <Clock size={12} />,
  'story-map': <Map size={13} />,
  storyline:   <BookOpen size={13} />,
  resources:   <Globe size={13} />,
}

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string; sort?: string; focus?: string }>
}) {
  const { tab = 'entities', type: selectedType, sort = 'frequency', focus } = await searchParams

  const [modeRow, projectSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'app_mode' } }),
    prisma.setting.findUnique({ where: { key: 'current_project_id' } }),
  ])
  const modeConfig = getModeConfig(modeRow?.value)
  if (!modeConfig.features.entities) notFound()
  const currentProjectId = projectSetting?.value || null

  const navItem = modeConfig.features.extraNavItems.find(i => i.href === '/entities')
  const pageTitle = navItem?.label ?? 'Investigation Hub'

  const tabs = [
    { id: 'entities',    label: navItem?.label ?? 'Entities' },
    ...(modeConfig.features.timeline ? [{ id: 'timeline', label: 'Timeline' }] : []),
    { id: 'story-map',  label: 'Story Map' },
    { id: 'storyline',  label: 'Storyline' },
    ...(modeConfig.features.investigationTemplate ? [{ id: 'resources', label: 'Investigative Hub' }] : []),
  ]

  const activeTab = tabs.find(t => t.id === tab)?.id ?? 'entities'

  // Show Inspector sidebar on entity-interactive tabs
  const showInspector = activeTab === 'entities' || activeTab === 'story-map'

  return (
    <EntitiesSearchProvider>
      <div className="flex flex-col h-full pb-4">
        {/* Header — fixed, never scrolls */}
        <div className="shrink-0 pt-2 pb-2">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50 flex items-center gap-2">
            <Users size={20} />
            {pageTitle}
          </h1>
          <p className="text-gray-500 dark:text-zinc-400 text-sm mt-0.5 mb-3">
            Entities, timeline, map, and story tools across your {modeConfig.navLibrary.toLowerCase()}.
          </p>

          <EntitiesSearchBar projectId={currentProjectId} activeTab={activeTab} />

          {/* Tab nav — pill style */}
          <div className="flex gap-1 mt-1 flex-wrap">
            {tabs.map(t => {
              const isActive = t.id === activeTab
              return (
                <Link
                  key={t.id}
                  href={`/entities?tab=${t.id}`}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                      : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {TAB_ICONS[t.id]}
                  {t.label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Tab content — fills remaining height, each tab scrolls internally */}
        <div className="flex-1 min-h-0 mt-3">
          {showInspector ? (
            <div className="flex gap-6 h-full">
              <div className="flex-1 min-w-0 overflow-y-auto pr-1">
                {activeTab === 'entities' && (
                  <EntitiesTab selectedType={selectedType} sort={sort} modeConfig={modeConfig} focus={focus} projectId={currentProjectId} />
                )}
                {activeTab === 'story-map' && <StoryMapTab projectId={currentProjectId} />}
              </div>
              <aside className="w-72 shrink-0 h-full border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-sm overflow-hidden bg-white dark:bg-zinc-900">
                <InspectorSidebar />
              </aside>
            </div>
          ) : (
            <div className="h-full overflow-y-auto pr-1">
              {activeTab === 'timeline' && modeConfig.features.timeline && (
                <div className="pb-8">
                  <TimelineTab modeConfig={modeConfig} projectId={currentProjectId} />
                </div>
              )}
              {activeTab === 'storyline' && <StorylineTab />}
              {activeTab === 'resources' && modeConfig.features.investigationTemplate && (
                <div className="pb-8"><OsintTab /></div>
              )}
            </div>
          )}
        </div>
      </div>
    </EntitiesSearchProvider>
  )
}

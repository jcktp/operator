import { prisma } from '@/lib/db'
import { WaybackTab, DiffTab, UsernameTab } from './ResearchClient'
import OsintBrowser from './OsintBrowser'
import ResearchTabs, { type ResearchTab } from './ResearchTabs'
import MonitorsClient from '@/app/monitors/MonitorsClient'

export const dynamic = 'force-dynamic'

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'wayback' } = await searchParams

  const validTabs: ResearchTab[] = ['wayback', 'diff', 'username', 'osint', 'monitor']
  const activeTab: ResearchTab = validTabs.includes(tab as ResearchTab)
    ? (tab as ResearchTab)
    : 'wayback'

  const [projects, projectSetting] = await Promise.all([
    prisma.project.findMany({
      select: {
        id: true, name: true,
        reports: { select: { id: true, title: true, rawContent: true }, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.setting.findUnique({ where: { key: 'current_project_id' } }),
  ])
  const currentProjectId = projectSetting?.value || null

  return (
    <div>
      <div className="sticky top-[88px] z-20 bg-[var(--background)] py-5 -mx-6 px-6 sm:-mx-8 sm:px-8 mb-3">
        <div className="mb-2">
          <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Research</h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">
            Wayback Machine, document diff, username search, OSINT directory and web monitoring.
          </p>
        </div>
        <ResearchTabs active={activeTab} />
      </div>

      {activeTab === 'wayback'  && <WaybackTab />}
      {activeTab === 'diff'     && <DiffTab projects={projects} />}
      {activeTab === 'username' && <UsernameTab />}
      {activeTab === 'osint'    && <OsintBrowser />}
      {activeTab === 'monitor'  && <MonitorsClient projectId={currentProjectId} />}
    </div>
  )
}

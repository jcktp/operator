import { prisma } from '@/lib/db'
import { getModeConfig } from '@/lib/mode'
import ProjectsClient from './ProjectsClient'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const [modeRow, currentSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'app_mode' } }),
    prisma.setting.findUnique({ where: { key: 'current_project_id' } }),
  ])
  const currentMode = modeRow?.value ?? ''
  const modeConfig = getModeConfig(currentMode)

  const projectRows = await prisma.project.findMany({
    where: currentMode ? { OR: [{ mode: currentMode }, { mode: '' }] } : {},
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { reports: true } } },
  })

  const projects = projectRows.map(p => ({
    id: p.id,
    name: p.name,
    area: p.area,
    startDate: p.startDate?.toISOString() ?? null,
    status: p.status,
    description: p.description ?? '',
    createdAt: p.createdAt.toISOString(),
    reportCount: p._count.reports,
  }))

  return (
    <ProjectsClient
      projects={projects}
      currentProjectId={currentSetting?.value ?? null}
      projectLabel={modeConfig.projectLabel}
      projectLabelPlural={modeConfig.projectLabelPlural}
      defaultAreas={modeConfig.defaultAreas}
      collabEnabled={process.env.COLLAB_ENABLED === 'true'}
    />
  )
}

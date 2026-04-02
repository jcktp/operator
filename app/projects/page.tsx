import { prisma } from '@/lib/db'
import { getModeConfig } from '@/lib/mode'
import ProjectsClient from './ProjectsClient'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const [projectRows, modeRow, currentSetting] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { reports: true } } },
    }),
    prisma.setting.findUnique({ where: { key: 'app_mode' } }),
    prisma.setting.findUnique({ where: { key: 'current_project_id' } }),
  ])

  const modeConfig = getModeConfig(modeRow?.value)

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
    />
  )
}

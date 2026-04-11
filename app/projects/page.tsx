import { prisma } from '@/lib/db'
import { getModeConfig } from '@/lib/mode'
import ProjectsClient from './ProjectsClient'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
 const [modeRow, currentSetting, collabRow] = await Promise.all([
 prisma.setting.findUnique({ where: { key: 'app_mode' } }),
 prisma.setting.findUnique({ where: { key: 'current_project_id' } }),
 prisma.setting.findUnique({ where: { key: 'collab_enabled' } }),
 ])
 const currentMode = modeRow?.value ?? ''
 const modeConfig = getModeConfig(currentMode)

 const [projectRows, shareGroups] = await Promise.all([
 prisma.project.findMany({
 where: currentMode ? { OR: [{ mode: currentMode }, { mode: '' }] } : {},
 orderBy: { createdAt: 'desc' },
 include: { _count: { select: { reports: true } } },
 }),
 prisma.projectShare.groupBy({
 by: ['projectId'],
 _count: { projectId: true },
 }),
 ])
 const shareCountMap = Object.fromEntries(shareGroups.map(g => [g.projectId, g._count.projectId]))

 const projects = projectRows.map(p => ({
 id: p.id,
 name: p.name,
 area: p.area,
 startDate: p.startDate?.toISOString() ?? null,
 status: p.status,
 description: p.description ?? '',
 createdAt: p.createdAt.toISOString(),
 reportCount: p._count.reports,
 shareCount: shareCountMap[p.id] ?? 0,
 }))

 return (
 <ProjectsClient
 projects={projects}
 currentProjectId={currentSetting?.value ?? null}
 projectLabel={modeConfig.projectLabel}
 projectLabelPlural={modeConfig.projectLabelPlural}
 defaultAreas={modeConfig.defaultAreas}
 collabEnabled={collabRow?.value === 'true' || process.env.COLLAB_ENABLED === 'true'}
 />
 )
}

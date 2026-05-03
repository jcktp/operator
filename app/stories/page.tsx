import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { parseJsonSafe } from '@/lib/utils'
import type { Insight } from '@/lib/utils'
import { isValidSession, SESSION_COOKIE } from '@/lib/auth'
import StoriesIndexClient from './StoriesIndexClient'

export const dynamic = 'force-dynamic'

export default async function StoriesIndexPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!(await isValidSession(token))) redirect('/login')

  const projectSetting = await prisma.setting.findUnique({ where: { key: 'current_project_id' } })
  const currentProjectId = projectSetting?.value || null

  // A story IS a project. Fetch all in-progress projects.
  const projects = await prisma.project.findMany({
    where: { status: 'in_progress' },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, name: true, updatedAt: true,
      narrative: true, storyStatus: true, storyDescription: true,
      storyReportIds: true, storyShared: true,
      reports: {
        select: { id: true, area: true, insights: true },
        take: 30,
      },
    },
  })

  const stories = projects.map(p => {
    const explicit: string[] = parseJsonSafe(p.storyReportIds, [])
    // Fall back to all project reports when none explicitly attached
    const reportIds = explicit.length > 0 ? explicit : p.reports.map(r => r.id)
    const attachedReports = p.reports.filter(r => reportIds.includes(r.id))

    const areaCounts: Record<string, number> = {}
    for (const r of attachedReports) areaCounts[r.area] = (areaCounts[r.area] ?? 0) + 1
    const area = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
      ?? p.reports[0]?.area ?? null

    const flagCount = attachedReports.reduce((sum, r) => {
      const list = parseJsonSafe<Insight[]>(r.insights, [])
      return sum + list.filter(i => i.type === 'risk' || i.type === 'anomaly').length
    }, 0)

    const snippet = (() => {
      const plain = p.narrative
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (!plain) return null
      return plain.length > 250 ? plain.slice(0, 247).trimEnd() + '…' : plain
    })()

    return {
      id: p.id,
      name: p.name,
      storyStatus: p.storyStatus,
      storyDescription: p.storyDescription,
      area,
      docCount: p.reports.length,
      attachedDocCount: attachedReports.length,
      flagCount,
      snippet,
      updatedAt: p.updatedAt.toISOString(),
    }
  })

  const allReports = await prisma.report.findMany({
    where: currentProjectId ? { projectId: currentProjectId } : {},
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, area: true },
    take: 200,
  })

  return <StoriesIndexClient stories={stories} allReports={allReports} />
}

import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { isValidSession, SESSION_COOKIE } from '@/lib/auth'
import StoryWorkspace from './StoryWorkspace'

export const dynamic = 'force-dynamic'

export default async function StoryWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!(await isValidSession(token))) redirect('/login')

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true, name: true, updatedAt: true,
      narrative: true, storyStatus: true, storyDescription: true,
      storyReportIds: true, storyEvents: true, storyClaimStatuses: true, storyShared: true,
    },
  })
  if (!project) notFound()

  // Activate this story as the current project so all nav items (Library, Dispatch,
  // Entities, etc.) are automatically scoped to it while you're working on it.
  await prisma.setting.upsert({
    where:  { key: 'current_project_id' },
    create: { key: 'current_project_id', value: id },
    update: { value: id },
  })

  const allReports = await prisma.report.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, area: true },
    take: 200,
  })

  return (
    <StoryWorkspace
      project={{
        id: project.id,
        name: project.name,
        narrative: project.narrative,
        storyStatus: project.storyStatus,
        storyDescription: project.storyDescription,
        storyReportIds: project.storyReportIds,
        storyEvents: project.storyEvents,
        storyClaimStatuses: project.storyClaimStatuses,
      }}
      allReports={allReports}
    />
  )
}

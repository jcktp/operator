import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { loadAiSettings } from '@/lib/settings'
import { logAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny
  await loadAiSettings()
  const [projects, currentSetting] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { reports: true } } },
    }),
    prisma.setting.findUnique({ where: { key: 'current_project_id' } }),
  ])
  return Response.json({ projects, currentProjectId: currentSetting?.value ?? null })
}

export async function POST(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const body = await req.json() as {
    name: string
    area?: string
    startDate?: string
    status?: string
    description?: string
  }
  if (!body.name?.trim()) return Response.json({ error: 'Name is required' }, { status: 400 })

  const project = await prisma.project.create({
    data: {
      name: body.name.trim(),
      area: body.area ?? '',
      startDate: body.startDate ? new Date(body.startDate) : null,
      status: body.status ?? 'in_progress',
      description: body.description ?? '',
    },
  })

  // Auto-set as current project
  await prisma.setting.upsert({
    where: { key: 'current_project_id' },
    update: { value: project.id },
    create: { key: 'current_project_id', value: project.id },
  })

  void logAction('project.created', project.name)
  return Response.json({ project })
}

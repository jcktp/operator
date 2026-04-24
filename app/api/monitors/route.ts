import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { checkDueMonitors } from '@/lib/web-monitor'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  try {
    const projectId = req.nextUrl.searchParams.get('projectId') ?? undefined

    const monitors = await prisma.webMonitor.findMany({
      where: projectId ? { projectId } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { changes: true } },
        changes: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, summary: true } },
      },
    })

    return NextResponse.json({ monitors })
  } catch (e) {
    console.error('[monitors] GET failed:', e)
    return NextResponse.json({ monitors: [] })
  }
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const body = await req.json() as {
    name: string
    url: string
    selector?: string
    intervalMins?: number
    projectId?: string
  }

  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!body.url?.trim()) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

  // Basic URL validation
  try { new URL(body.url) } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const monitor = await prisma.webMonitor.create({
    data: {
      name: body.name.trim(),
      url: body.url.trim(),
      selector: body.selector?.trim() || null,
      intervalMins: body.intervalMins ?? 60,
      projectId: body.projectId ?? null,
    },
  })

  return NextResponse.json({ monitor }, { status: 201 })
}

/** PATCH on the collection triggers a check of all due monitors */
export async function PATCH(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  try {
    const result = await checkDueMonitors()
    return NextResponse.json(result)
  } catch (e) {
    console.error('[monitors] check failed:', e)
    return NextResponse.json({ checked: 0, changed: 0 })
  }
}

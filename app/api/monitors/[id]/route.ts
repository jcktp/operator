import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  const monitor = await prisma.webMonitor.findUnique({
    where: { id },
    include: {
      changes: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  })

  if (!monitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ monitor })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  const body = await req.json() as {
    name?: string
    url?: string
    selector?: string | null
    intervalMins?: number
    status?: string
  }

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name.trim()
  if (body.url !== undefined) {
    try { new URL(body.url) } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }
    data.url = body.url.trim()
  }
  if (body.selector !== undefined) data.selector = body.selector?.trim() || null
  if (body.intervalMins !== undefined) data.intervalMins = body.intervalMins
  if (body.status !== undefined) data.status = body.status

  const monitor = await prisma.webMonitor.update({ where: { id }, data })
  return NextResponse.json({ monitor })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  await prisma.webMonitor.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

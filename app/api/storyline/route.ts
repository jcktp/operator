import { NextResponse , NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { errorResponse } from '@/lib/api-error'

// GET /api/storyline — list all stories
export async function GET(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
    const url = new URL(req.url)
    const take = Math.min(Number(url.searchParams.get('limit')) || 100, 500)
    const skip = Number(url.searchParams.get('offset')) || 0

    const stories = await prisma.story.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { evidence: { orderBy: { createdAt: 'asc' }, take: 50 } },
      take,
      skip,
    })
    return NextResponse.json({ stories })
  } catch (e) {
    return errorResponse(e)
  }
}

// POST /api/storyline — create a story
export async function POST(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
    const body = await req.json() as { title: string; reportIds: string[]; description?: string; status?: string }
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    const story = await prisma.story.create({
      data: {
        title: body.title.trim(),
        description: body.description ?? null,
        status: body.status ?? 'researching',
        reportIds: JSON.stringify(body.reportIds ?? []),
      },
      include: { evidence: true },
    })
    return NextResponse.json({ story }, { status: 201 })
  } catch (e) {
    return errorResponse(e)
  }
}

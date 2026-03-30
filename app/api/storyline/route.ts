import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/storyline — list all stories
export async function GET() {
  const stories = await prisma.story.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { evidence: { orderBy: { createdAt: 'asc' } } },
  })
  return NextResponse.json({ stories })
}

// POST /api/storyline — create a story
export async function POST(req: Request) {
  const body = await req.json() as { title: string; reportIds: string[] }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }
  const story = await prisma.story.create({
    data: {
      title: body.title.trim(),
      reportIds: JSON.stringify(body.reportIds ?? []),
    },
    include: { evidence: true },
  })
  return NextResponse.json({ story }, { status: 201 })
}

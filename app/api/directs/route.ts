import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const directs = await prisma.directReport.findMany({
      include: {
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true, area: true },
        },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ directs })
  } catch (e) {
    console.error('directs GET error:', e)
    return NextResponse.json({ error: 'Failed to load team members' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, title, email, area } = body

    if (!name || !title || !area) {
      return NextResponse.json({ error: 'Name, title, and area are required' }, { status: 400 })
    }

    const direct = await prisma.directReport.create({
      data: { name, title, email: email || null, area },
    })
    return NextResponse.json({ direct })
  } catch (e) {
    console.error('directs POST error:', e)
    return NextResponse.json({ error: 'Failed to create team member' }, { status: 500 })
  }
}

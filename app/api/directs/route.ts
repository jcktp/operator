import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
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
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, title, email, area } = body

  if (!name || !title || !area) {
    return NextResponse.json({ error: 'Name, title, and area are required' }, { status: 400 })
  }

  const direct = await prisma.directReport.create({
    data: { name, title, email: email || null, area },
  })
  return NextResponse.json({ direct })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day // Monday
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export async function GET() {
  const entries = await prisma.journalEntry.findMany({
    orderBy: { weekStart: 'desc' },
  })
  return NextResponse.json({ entries })
}

export async function POST(req: NextRequest) {
  const { weekStart, content } = await req.json()
  const ws = weekStart ? new Date(weekStart) : getWeekStart(new Date())

  const entry = await prisma.journalEntry.upsert({
    where: { weekStart: ws },
    update: { content },
    create: { weekStart: ws, content },
  })
  return NextResponse.json({ entry })
}

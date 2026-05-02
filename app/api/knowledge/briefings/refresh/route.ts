import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { generateAreaBriefing } from '@/lib/ai'

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { area } = await req.json() as { area?: string }
  if (!area?.trim()) return NextResponse.json({ error: 'area required' }, { status: 400 })

  const reports = await prisma.report.findMany({
    where: { area },
    select: { summary: true, metrics: true, insights: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  if (reports.length === 0) {
    return NextResponse.json({ error: 'No reports found for this area' }, { status: 404 })
  }

  const briefing = await generateAreaBriefing(area, 'journalism', reports)
  return NextResponse.json({ briefing })
}

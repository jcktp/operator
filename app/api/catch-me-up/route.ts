import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { loadAiSettings } from '@/lib/settings'
import { generateCatchMeUp } from '@/lib/ai'

export async function GET() {
  try {
    await loadAiSettings()

    const reports = await prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        area: true,
        summary: true,
        metrics: true,
        insights: true,
        createdAt: true,
        directReport: { select: { name: true } },
      },
    })

    const digest = await generateCatchMeUp(
      reports.map(r => ({
        area: r.area,
        directName: r.directReport?.name,
        date: r.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        summary: r.summary ?? '',
        metrics: r.metrics ?? '[]',
        insights: r.insights ?? '[]',
      }))
    )

    return NextResponse.json({ digest })
  } catch (e) {
    console.error('catch-me-up error:', e)
    return NextResponse.json({ error: 'Failed to generate digest' }, { status: 500 })
  }
}

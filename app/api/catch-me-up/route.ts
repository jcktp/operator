import { NextResponse , NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { loadAiSettings } from '@/lib/settings'
import { generateCatchMeUp } from '@/lib/ai'

export async function GET(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
    await loadAiSettings()
    const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
    const appMode = modeRow?.value ?? 'journalism'

    const reports = await prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        area: true,
        title: true,
        summary: true,
        metrics: true,
        insights: true,
        questions: true,
        reportDate: true,
        createdAt: true,
        directReport: { select: { name: true } },
      },
    })

    const digest = await generateCatchMeUp(
      reports.map(r => ({
        area: r.area,
        title: r.title,
        directName: r.directReport?.name,
        date: r.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        summary: r.summary ?? '',
        metrics: r.metrics ?? '[]',
        insights: r.insights ?? '[]',
        questions: r.questions ?? '[]',
        reportDate: r.reportDate?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      appMode
    )

    return NextResponse.json({ digest })
  } catch (e) {
    console.error('catch-me-up error:', e)
    return NextResponse.json({ error: 'Failed to generate digest' }, { status: 500 })
  }
}

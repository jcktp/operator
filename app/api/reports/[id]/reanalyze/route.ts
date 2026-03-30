import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { loadAiSettings } from '@/lib/settings'
import { analyzeReport } from '@/lib/ai'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const report = await prisma.report.findUnique({
    where: { id },
    select: { id: true, rawContent: true, title: true, area: true, directReportId: true },
  })
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!report.rawContent || report.rawContent.trim().length < 10) {
    return NextResponse.json({ error: 'Report has no readable content to analyse' }, { status: 422 })
  }

  let directName: string | undefined
  if (report.directReportId) {
    const direct = await prisma.directReport.findUnique({ where: { id: report.directReportId } })
    if (direct) directName = direct.name
  }

  await loadAiSettings()

  const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  const analysis = await analyzeReport(report.rawContent, report.title, report.area, directName, modeRow?.value)

  // Only commit if we got a real result (not the error-message fallback)
  if (!analysis.summary || analysis.summary.startsWith('Analysis could not be completed')) {
    return NextResponse.json({ error: analysis.summary || 'Analysis returned no content' }, { status: 502 })
  }

  const updated = await prisma.report.update({
    where: { id },
    data: {
      summary: analysis.summary.trim(),
      metrics: analysis.metrics.length > 0 ? JSON.stringify(analysis.metrics) : null,
      insights: analysis.insights.length > 0 ? JSON.stringify(analysis.insights) : null,
      questions: analysis.questions.length > 0 ? JSON.stringify(analysis.questions) : null,
    },
    include: { directReport: true },
  })

  return NextResponse.json({ report: updated })
}

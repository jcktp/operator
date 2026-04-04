import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { loadAiSettings } from '@/lib/settings'
import { analyzeReport, extractEntities, extractTimeline } from '@/lib/ai'
import { getModeConfig } from '@/lib/mode'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params

  const report = await prisma.report.findUnique({
    where: { id },
    select: { id: true, rawContent: true, title: true, area: true, directReportId: true },
  })
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!report.rawContent || report.rawContent.trim().length < 10) {
    return NextResponse.json({ error: 'Report has no readable content to analyse' }, { status: 422 })
  }
  if (report.rawContent.startsWith('[Image')) {
    return NextResponse.json({ error: 'Image reports cannot be re-analysed — re-upload with a vision-capable model to extract content first' }, { status: 422 })
  }

  let directName: string | undefined
  if (report.directReportId) {
    const direct = await prisma.directReport.findUnique({ where: { id: report.directReportId } })
    if (direct) directName = direct.name
  }

  await loadAiSettings()

  const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  const appMode = modeRow?.value
  const modeFeatures = getModeConfig(appMode).features

  const analysis = await analyzeReport(report.rawContent, report.title, report.area, directName, appMode)

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

  // Re-extract entities and timeline if the mode supports them
  if (modeFeatures.entities || modeFeatures.timeline) {
    await Promise.all([
      modeFeatures.entities
        ? (async () => {
            try {
              const entities = await extractEntities(report.rawContent!, report.title, report.area)
              if (entities.length > 0) {
                await prisma.reportEntity.deleteMany({ where: { reportId: id } })
                await prisma.reportEntity.createMany({
                  data: entities.map(e => ({
                    reportId: id, type: e.type, name: e.name, context: e.context ?? null,
                  })),
                })
              }
            } catch (e) { console.error('Entity re-extraction failed:', e) }
          })()
        : Promise.resolve(),
      modeFeatures.timeline
        ? (async () => {
            try {
              const events = await extractTimeline(report.rawContent!, report.title)
              if (events.length > 0) {
                await prisma.timelineEvent.deleteMany({ where: { reportId: id } })
                await prisma.timelineEvent.createMany({
                  data: events.map(e => ({
                    reportId: id, dateText: e.dateText, dateSortKey: e.dateSortKey ?? null, event: e.event,
                  })),
                })
              }
            } catch (e) { console.error('Timeline re-extraction failed:', e) }
          })()
        : Promise.resolve(),
    ])
  }

  return NextResponse.json({ report: updated })
}

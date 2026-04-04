import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { analyzeReport } from '@/lib/ai'
import { loadAiSettings } from '@/lib/settings'

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
    const { title, text, area, reportDate } = await req.json()

    if (!title || !title.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    if (!text  || !text.trim())  return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    if (!area)                   return NextResponse.json({ error: 'Area is required' }, { status: 400 })

    await loadAiSettings()

    let analysis = null
    try {
      analysis = await analyzeReport(text, title, area)
    } catch (e) {
      console.error('AI analysis failed:', e)
    }

    const report = await prisma.report.create({
      data: {
        title,
        fileName: 'browser-import.txt',
        fileType: 'txt',
        fileSize: text.length,
        rawContent: text,
        area,
        reportDate: reportDate ? new Date(reportDate) : null,
        summary: analysis?.summary ?? null,
        metrics: analysis?.metrics ? JSON.stringify(analysis.metrics) : null,
        insights: analysis?.insights ? JSON.stringify(analysis.insights) : null,
        questions: analysis?.questions ? JSON.stringify(analysis.questions) : null,
      },
      include: { directReport: true },
    })

    return NextResponse.json({ report })
  } catch (e) {
    console.error('Browser import error:', e)
    return NextResponse.json({ error: 'Failed to import' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { extractText, getFileType } from '@/lib/parsers'
import { analyzeReport, compareReports } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string
    const area = formData.get('area') as string
    const directReportId = formData.get('directReportId') as string | null
    const reportDate = formData.get('reportDate') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    if (!area) return NextResponse.json({ error: 'Area is required' }, { status: 400 })

    const fileType = getFileType(file.name)
    const buffer = Buffer.from(await file.arrayBuffer())

    let rawContent: string
    try {
      rawContent = await extractText(buffer, fileType)
    } catch (e) {
      return NextResponse.json({ error: `Could not read file: ${e}` }, { status: 422 })
    }

    if (!rawContent || rawContent.trim().length < 10) {
      return NextResponse.json({ error: 'File appears to be empty or unreadable' }, { status: 422 })
    }

    // Apply saved Ollama settings
    const settings = await prisma.setting.findMany()
    for (const s of settings) {
      if (s.key === 'ollama_host') process.env.OLLAMA_HOST = s.value
      if (s.key === 'ollama_model') process.env.OLLAMA_MODEL = s.value
    }

    // Get direct report name if provided
    let directName: string | undefined
    if (directReportId) {
      const direct = await prisma.directReport.findUnique({ where: { id: directReportId } })
      if (direct) directName = direct.name
    }

    // Find the most recent prior report for the same area (for comparison)
    const previousReport = await prisma.report.findFirst({
      where: {
        area,
        ...(directReportId ? { directReportId } : {}),
        summary: { not: null },
        metrics: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Run AI analysis
    let analysis = null
    try {
      analysis = await analyzeReport(rawContent, title, area, directName)
    } catch (e) {
      console.error('AI analysis failed:', e)
    }

    // Run comparison against previous report (if one exists and analysis succeeded)
    let comparison = null
    if (previousReport && analysis && previousReport.summary && previousReport.metrics) {
      try {
        comparison = await compareReports(
          previousReport.summary,
          previousReport.metrics,
          analysis.summary,
          JSON.stringify(analysis.metrics),
          area
        )
      } catch (e) {
        console.error('Comparison failed:', e)
      }
    }

    const report = await prisma.report.create({
      data: {
        title,
        fileName: file.name,
        fileType,
        fileSize: file.size,
        rawContent,
        area,
        directReportId: directReportId || null,
        reportDate: reportDate ? new Date(reportDate) : null,
        summary: analysis?.summary ?? null,
        metrics: analysis?.metrics ? JSON.stringify(analysis.metrics) : null,
        insights: analysis?.insights ? JSON.stringify(analysis.insights) : null,
        questions: analysis?.questions ? JSON.stringify(analysis.questions) : null,
        comparison: comparison ? JSON.stringify(comparison) : null,
      },
      include: { directReport: true },
    })

    return NextResponse.json({ report, hasPrevious: !!previousReport })
  } catch (e) {
    console.error('Upload error:', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

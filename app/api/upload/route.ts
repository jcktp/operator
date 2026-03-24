import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { loadAiSettings } from '@/lib/settings'
import { extractContent, getFileType, IMAGE_TYPES, getMimeType } from '@/lib/parsers'
import { analyzeReport, compareReports, checkResolvedFlags, describeImage } from '@/lib/ai'
import { saveReportFile } from '@/lib/reports-folder'
import { logAction } from '@/lib/audit'
import { join } from 'path'

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
    const isImage = IMAGE_TYPES.has(fileType.toLowerCase())

    // Save original file to ~/Documents/Operator Reports/{area}/
    let savedFileName = file.name
    try { savedFileName = saveReportFile(buffer, file.name, area).split('/').pop() ?? file.name } catch (e) {
      console.warn('Could not save to reports folder:', e)
    }

    await loadAiSettings()

    // Handle images separately
    if (isImage) {
      const mimeType = getMimeType(fileType)
      const description = await describeImage(buffer, mimeType)
      const relativePath = join(area, savedFileName)

      const report = await prisma.report.create({
        data: {
          title,
          fileName: file.name,
          fileType,
          fileSize: file.size,
          rawContent: description,
          displayContent: `image:${relativePath}`,
          imagePath: relativePath,
          area,
          directReportId: directReportId || null,
          reportDate: reportDate ? new Date(reportDate) : null,
          summary: description.startsWith('[') ? null : description.slice(0, 300),
        },
        include: { directReport: true },
      })
      return NextResponse.json({ report, hasPrevious: false })
    }

    let rawContent: string
    let displayContent: string | null = null
    try {
      const parsed = await extractContent(buffer, fileType)
      rawContent = parsed.text
      displayContent = parsed.displayContent ?? null
    } catch (e) {
      return NextResponse.json({ error: `Could not read file: ${e}` }, { status: 422 })
    }

    if (!rawContent || rawContent.trim().length < 10) {
      return NextResponse.json({ error: 'File appears to be empty or unreadable' }, { status: 422 })
    }

    // Get direct report name if provided
    let directName: string | undefined
    if (directReportId) {
      const direct = await prisma.directReport.findUnique({ where: { id: directReportId } })
      if (direct) directName = direct.name
    }

    // Find the most recent prior report for the same area (for comparison + series detection)
    const previousReport = await prisma.report.findFirst({
      where: {
        area,
        ...(directReportId ? { directReportId } : {}),
        summary: { not: null },
        metrics: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Series candidate: reports from same source (directReport + area) with 2+ existing
    const seriesCount = directReportId ? await prisma.report.count({
      where: { area, directReportId },
    }) : 0
    const seriesCandidate = seriesCount >= 1 ? {
      count: seriesCount,
      area,
      directReportId,
      existingSeriesId: previousReport?.seriesId ?? null,
    } : null

    // Run AI analysis
    let analysis = null
    try {
      analysis = await analyzeReport(rawContent, title, area, directName)
    } catch (e) {
      console.error('AI analysis failed:', e)
    }

    // Run comparison against previous report
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

    // Check which previous flags are now resolved
    let resolvedFlagsJson: string | null = null
    if (previousReport?.insights && analysis) {
      try {
        type PrevInsight = { type: string; text: string }
        const prevInsights: PrevInsight[] = JSON.parse(previousReport.insights)
        const prevFlags = prevInsights.filter(i => i.type === 'risk' || i.type === 'anomaly')
        if (prevFlags.length > 0) {
          const resolved = await checkResolvedFlags(prevFlags, rawContent, analysis.insights)
          if (resolved.length > 0) resolvedFlagsJson = JSON.stringify(resolved)
        }
      } catch (e) {
        console.error('Resolved flags check failed:', e)
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
        resolvedFlags: resolvedFlagsJson,
        displayContent,
      },
      include: { directReport: true },
    })

    void logAction('report:upload', `${title} (${area})`)
    return NextResponse.json({ report, hasPrevious: !!previousReport, seriesCandidate })
  } catch (e) {
    console.error('Upload error:', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

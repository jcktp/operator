import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { loadAiSettings } from '@/lib/settings'
import { extractContent, getFileType } from '@/lib/parsers'
import { analyzeReport, compareReports } from '@/lib/ai'
import { saveReportFile } from '@/lib/reports-folder'
import { fetchGoogleContent, isGoogleUrl } from '@/lib/google-fetch'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const request = await prisma.reportRequest.findUnique({
      where: { token },
      include: { directReport: true },
    })

    if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    if (request.status === 'submitted') return NextResponse.json({ error: 'Already submitted' }, { status: 409 })
    if (request.expiresAt && request.expiresAt < new Date()) {
      return NextResponse.json({ error: 'This request link has expired' }, { status: 410 })
    }

    await loadAiSettings()

    let buffer: Buffer
    let fileType: string
    let fileName: string
    let reportDate: Date | null = null

    const contentType = req.headers.get('content-type') ?? ''
    let submitterName: string | null = null

    if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      const dateStr = formData.get('reportDate') as string | null
      submitterName = (formData.get('submitterName') as string | null) || null

      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

      buffer = Buffer.from(await file.arrayBuffer())
      fileType = getFileType(file.name)
      fileName = file.name
      if (dateStr) reportDate = new Date(dateStr)
    } else {
      // JSON with Google URL
      const body = await req.json() as { googleUrl?: string; reportDate?: string; submitterName?: string }
      const { googleUrl, reportDate: dateStr, submitterName: sName } = body
      submitterName = sName || null

      if (!googleUrl || !isGoogleUrl(googleUrl)) {
        return NextResponse.json({ error: 'Invalid Google Sheets or Docs URL' }, { status: 400 })
      }

      const fetched = await fetchGoogleContent(googleUrl)
      buffer = fetched.buffer
      fileType = fetched.fileType
      fileName = fetched.fileName
      if (dateStr) reportDate = new Date(dateStr)
    }

    // Parse content
    const { text: rawContent, displayContent = null } = await extractContent(buffer, fileType)

    if (!rawContent || rawContent.trim().length < 10) {
      return NextResponse.json({ error: 'File appears to be empty or unreadable' }, { status: 422 })
    }

    // Save to reports folder
    try { saveReportFile(buffer, fileName, request.area) } catch {}

    // Resolve directReportId: use request's linked direct, or match by submitter name
    let resolvedDirectId = request.directReportId || null
    if (!resolvedDirectId && submitterName) {
      const allDirects = await prisma.directReport.findMany({ select: { id: true, name: true } })
      const lower = submitterName.toLowerCase()
      const matched = allDirects.find((d: { id: string; name: string }) => d.name.toLowerCase() === lower)
      if (matched) resolvedDirectId = matched.id
    }
    const directReportName = request.directReport?.name ?? submitterName ?? undefined

    // Find previous report for comparison
    const previousReport = await prisma.report.findFirst({
      where: {
        area: request.area,
        ...(resolvedDirectId ? { directReportId: resolvedDirectId } : {}),
        summary: { not: null },
        metrics: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    })

    // AI analysis
    let analysis = null
    try {
      analysis = await analyzeReport(rawContent, request.title, request.area, directReportName)
    } catch (e) {
      console.error('AI analysis failed:', e)
    }

    // Comparison
    let comparison = null
    if (previousReport && analysis && previousReport.summary && previousReport.metrics) {
      try {
        comparison = await compareReports(
          previousReport.summary,
          previousReport.metrics,
          analysis.summary,
          JSON.stringify(analysis.metrics),
          request.area
        )
      } catch (e) {
        console.error('Comparison failed:', e)
      }
    }

    const report = await prisma.report.create({
      data: {
        title: request.title,
        fileName,
        fileType,
        fileSize: buffer.length,
        rawContent,
        displayContent,
        area: request.area,
        directReportId: resolvedDirectId,
        reportDate,
        summary: analysis?.summary ?? null,
        metrics: analysis?.metrics ? JSON.stringify(analysis.metrics) : null,
        insights: analysis?.insights ? JSON.stringify(analysis.insights) : null,
        questions: analysis?.questions ? JSON.stringify(analysis.questions) : null,
        comparison: comparison ? JSON.stringify(comparison) : null,
      },
    })

    // Mark request as submitted
    await prisma.reportRequest.update({
      where: { token },
      data: { status: 'submitted' },
    })

    return NextResponse.json({ ok: true, reportId: report.id })
  } catch (e) {
    console.error('Submit error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

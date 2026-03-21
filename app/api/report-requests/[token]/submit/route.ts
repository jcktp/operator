import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
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

    // Apply AI settings
    const settings = await prisma.setting.findMany()
    for (const s of settings) {
      if (s.key === 'ollama_host')   process.env.OLLAMA_HOST = s.value
      if (s.key === 'ollama_model')  process.env.OLLAMA_MODEL = s.value
      if (s.key === 'ai_provider')   process.env.AI_PROVIDER = s.value
      if (s.key === 'anthropic_key') process.env.ANTHROPIC_API_KEY = s.value
      if (s.key === 'openai_key')    process.env.OPENAI_API_KEY = s.value
      if (s.key === 'google_key')    process.env.GOOGLE_API_KEY = s.value
      if (s.key === 'groq_key')      process.env.GROQ_API_KEY = s.value
    }

    let buffer: Buffer
    let fileType: string
    let fileName: string
    let reportDate: Date | null = null

    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      const dateStr = formData.get('reportDate') as string | null

      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

      buffer = Buffer.from(await file.arrayBuffer())
      fileType = getFileType(file.name)
      fileName = file.name
      if (dateStr) reportDate = new Date(dateStr)
    } else {
      // JSON with Google URL
      const body = await req.json() as { googleUrl?: string; reportDate?: string }
      const { googleUrl, reportDate: dateStr } = body

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

    // Find previous report for comparison
    const previousReport = await prisma.report.findFirst({
      where: {
        area: request.area,
        ...(request.directReportId ? { directReportId: request.directReportId } : {}),
        summary: { not: null },
        metrics: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    })

    // AI analysis
    let analysis = null
    try {
      analysis = await analyzeReport(rawContent, request.title, request.area, request.directReport?.name)
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
        directReportId: request.directReportId || null,
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

import { NextRequest, NextResponse, after } from 'next/server'
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

    let buffer: Buffer
    let fileType: string
    let fileName: string
    let reportDate: Date | null = null

    const contentType = req.headers.get('content-type') ?? ''
    let submitterName: string | null = null

    if (contentType.includes('multipart/form-data')) {
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

    // Look up project name for folder scoping
    let projectName: string | undefined
    if (request.projectId) {
      const proj = await prisma.project.findUnique({ where: { id: request.projectId }, select: { name: true } })
      projectName = proj?.name ?? undefined
    }

    // Save to reports folder
    let savedFilePath: string | null = null
    try { savedFilePath = saveReportFile(buffer, fileName, request.area, projectName) } catch {}

    // Resolve directReportId — or auto-create contact from submitter name
    let resolvedDirectId = request.directReportId || null
    if (!resolvedDirectId && submitterName) {
      const allDirects = await prisma.directReport.findMany({ select: { id: true, name: true } })
      const lower = submitterName.toLowerCase()
      const matched = allDirects.find((d: { id: string; name: string }) => d.name.toLowerCase() === lower)
      if (matched) {
        resolvedDirectId = matched.id
      } else {
        // Auto-add submitter to the directory
        const newContact = await prisma.directReport.create({
          data: { name: submitterName, title: 'Submitter', area: request.area },
        })
        resolvedDirectId = newContact.id
      }
    }
    const directReportName = request.directReport?.name ?? submitterName ?? undefined

    // Create report immediately with raw content — analysis runs after response is sent
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
        projectId: request.projectId || null,
        filePath: savedFilePath,
        reportDate,
        summary: null,
        metrics: null,
        insights: null,
        questions: null,
        comparison: null,
      },
    })

    // Mark request as submitted
    await prisma.reportRequest.update({
      where: { token },
      data: { status: 'submitted' },
    })

    // Run AI analysis after the response is sent — submitter sees confirmation immediately
    after(async () => {
      try {
        await loadAiSettings()

        const previousReport = await prisma.report.findFirst({
          where: {
            area: request.area,
            id: { not: report.id },
            ...(resolvedDirectId ? { directReportId: resolvedDirectId } : {}),
            summary: { not: null },
            metrics: { not: null },
          },
          orderBy: { createdAt: 'desc' },
        })

        const analysis = await analyzeReport(rawContent, request.title, request.area, directReportName)

        let comparison = null
        if (previousReport && previousReport.summary && previousReport.metrics) {
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

        await prisma.report.update({
          where: { id: report.id },
          data: {
            summary: analysis.summary,
            metrics: JSON.stringify(analysis.metrics),
            insights: JSON.stringify(analysis.insights),
            questions: JSON.stringify(analysis.questions),
            comparison: comparison ? JSON.stringify(comparison) : null,
          },
        })
      } catch (e) {
        console.error('Background AI analysis failed:', e)
      }
    })

    return NextResponse.json({ ok: true, reportId: report.id })
  } catch (e) {
    console.error('Submit error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

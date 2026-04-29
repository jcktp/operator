import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { loadAiSettings } from '@/lib/settings'
import { extractContent, getFileType, IMAGE_TYPES, AUDIO_TYPES, getMimeType, getAudioMimeType } from '@/lib/parsers'
import { analyzeReport, compareReports, checkResolvedFlags, describeImage, transcribeAudio, extractEntities, extractTimeline, detectRedactions, compareDocumentsJournalism, generateVerificationChecklist, generateAreaBriefing } from '@/lib/ai'
import { saveReportFile } from '@/lib/reports-folder'
import { logAction } from '@/lib/audit'
import { getModeConfig } from '@/lib/mode'
import { scanFile } from '@/lib/file-scan'
import { canTranscribeAudio, audioUnavailableReason } from '@/lib/model-capabilities'

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
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

    const projectId = formData.get('projectId') as string | null

    const fileType = getFileType(file.name)
    const buffer = Buffer.from(await file.arrayBuffer())
    const isImage = IMAGE_TYPES.has(fileType.toLowerCase())
    const isAudio = AUDIO_TYPES.has(fileType.toLowerCase())

    // Scan before saving or processing anything
    const scan = scanFile(buffer, file.name)
    if (!scan.safe) return NextResponse.json({ error: `File rejected: ${scan.reason}` }, { status: 422 })

    await loadAiSettings()

    // Pre-flight: reject audio uploads when no audio-capable model is configured
    if (isAudio && !canTranscribeAudio()) {
      return NextResponse.json({ error: audioUnavailableReason() }, { status: 422 })
    }

    // Look up project name for folder scoping
    let projectName: string | undefined
    if (projectId) {
      const proj = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } })
      projectName = proj?.name ?? undefined
    }

    // Save original file — returns relative path within getReportsRoot()
    let savedFilePath: string | null = null
    try {
      savedFilePath = saveReportFile(buffer, file.name, area, projectName)
    } catch (e) {
      console.warn('Could not save to reports folder:', e)
    }

    // Handle audio files — transcribe then analyse transcript
    if (isAudio) {
      const mimeType = getAudioMimeType(fileType)
      const transcript = await transcribeAudio(buffer, mimeType, file.name)
      if (!transcript || transcript.startsWith('[Audio transcription')) {
        return NextResponse.json({ error: transcript || 'Audio transcription returned no text.' }, { status: 422 })
      }

      let directName: string | undefined
      if (directReportId) {
        const direct = await prisma.directReport.findUnique({ where: { id: directReportId } })
        if (direct) directName = direct.name
      }
      const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
      const appMode = modeRow?.value ?? 'journalism'

      let analysis = null
      try { analysis = await analyzeReport(transcript, title, area, directName, appMode) }
      catch (e) { console.error('AI analysis failed on audio transcript:', e) }

      const report = await prisma.report.create({
        data: {
          title,
          fileName: file.name,
          fileType,
          fileSize: file.size,
          rawContent: transcript,
          area,
          directReportId: directReportId || null,
          reportDate: reportDate ? new Date(reportDate) : null,
          summary: analysis?.summary?.trim() || null,
          metrics: analysis?.metrics ? JSON.stringify(analysis.metrics) : null,
          insights: analysis?.insights ? JSON.stringify(analysis.insights) : null,
          questions: analysis?.questions ? JSON.stringify(analysis.questions) : null,
          filePath: savedFilePath,
        },
        include: { directReport: true },
      })
      void logAction('report:upload', `${title} (${area}) [audio]`)
      return NextResponse.json({ report, hasPrevious: false })
    }

    // Handle images separately
    if (isImage) {
      const mimeType = getMimeType(fileType)
      const description = await describeImage(buffer, mimeType)

      const report = await prisma.report.create({
        data: {
          title,
          fileName: file.name,
          fileType,
          fileSize: file.size,
          rawContent: description,
          displayContent: savedFilePath ? `image:${savedFilePath}` : null,
          imagePath: savedFilePath,
          filePath: savedFilePath,
          area,
          directReportId: directReportId || null,
          reportDate: reportDate ? new Date(reportDate) : null,
          projectId: projectId || null,
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

    // Read mode from DB — process.env.APP_MODE is not reliably set at runtime
    const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
    const appMode = modeRow?.value ?? 'journalism'

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
      analysis = await analyzeReport(rawContent, title, area, directName, appMode)
    } catch (e) {
      console.error('AI analysis failed:', e)
    }

    // Run comparison and flag checks in parallel (both depend on analysis but not each other)
    let comparison = null
    let resolvedFlagsJson: string | null = null

    type PrevInsight = { type: string; text: string }

    await Promise.all([
      // Comparison against previous report
      (async () => {
        if (!previousReport || !analysis || !previousReport.summary || !previousReport.metrics) return
        try {
          comparison = await compareReports(
            previousReport.summary,
            previousReport.metrics,
            analysis.summary,
            JSON.stringify(analysis.metrics),
            area,
            appMode
          )
        } catch (e) { console.error('Comparison failed:', e) }
      })(),

      // Check which previous flags are now resolved
      (async () => {
        if (!previousReport?.insights || !analysis) return
        try {
          const prevInsights: PrevInsight[] = JSON.parse(previousReport.insights)
          const prevFlags = prevInsights.filter(i => i.type === 'risk' || i.type === 'anomaly')
          if (prevFlags.length > 0) {
            const resolved = await checkResolvedFlags(prevFlags, rawContent, analysis.insights)
            if (resolved.length > 0) resolvedFlagsJson = JSON.stringify(resolved)
          }
        } catch (e) { console.error('Resolved flags check failed:', e) }
      })(),
    ])

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
        summary: analysis?.summary?.trim() || null,
        metrics: analysis?.metrics ? JSON.stringify(analysis.metrics) : null,
        insights: analysis?.insights ? JSON.stringify(analysis.insights) : null,
        questions: analysis?.questions ? JSON.stringify(analysis.questions) : null,
        comparison: comparison ? JSON.stringify(comparison) : null,
        resolvedFlags: resolvedFlagsJson,
        displayContent,
        filePath: savedFilePath,
      },
      include: { directReport: true },
    })

    // Optional mode features: additional analysis steps — all run in parallel
    const modeFeatures = getModeConfig(appMode).features
    if (modeFeatures.entities || modeFeatures.timeline || modeFeatures.redactions || modeFeatures.verification || modeFeatures.documentComparison) {
      let entitiesResult: Awaited<ReturnType<typeof extractEntities>> = []
      let eventsResult: Awaited<ReturnType<typeof extractTimeline>> = []
      let redactionsJson: string | null = null
      let journalismComparisonJson: string | null = null
      let verificationChecklistJson: string | null = null

      await Promise.all([
        (async () => {
          if (!modeFeatures.entities) return
          try { entitiesResult = await extractEntities(rawContent, title, area) }
          catch (e) { console.error('Entity extraction failed:', e) }
        })(),
        (async () => {
          if (!modeFeatures.timeline) return
          try { eventsResult = await extractTimeline(rawContent, title) }
          catch (e) { console.error('Timeline extraction failed:', e) }
        })(),
        (async () => {
          if (!modeFeatures.redactions) return
          try {
            const redactions = await detectRedactions(rawContent, title)
            if (redactions.length > 0) redactionsJson = JSON.stringify(redactions)
          } catch (e) { console.error('Redaction detection failed:', e) }
        })(),
        (async () => {
          if (!modeFeatures.documentComparison) return
          if (!previousReport?.rawContent || previousReport.rawContent.trim().length <= 10) return
          try {
            const jComp = await compareDocumentsJournalism(
              previousReport.rawContent, previousReport.title, rawContent, title
            )
            journalismComparisonJson = JSON.stringify(jComp)
          } catch (e) { console.error('Journalism comparison failed:', e) }
        })(),
        (async () => {
          if (!modeFeatures.verification) return
          try {
            const checklist = await generateVerificationChecklist(rawContent, title, area)
            if (checklist.length > 0) verificationChecklistJson = JSON.stringify(checklist)
          } catch (e) { console.error('Verification checklist failed:', e) }
        })(),
      ])

      // Persist results
      await Promise.all([
        entitiesResult.length > 0
          ? prisma.reportEntity.createMany({
              data: entitiesResult.map(e => ({
                reportId: report.id, type: e.type, name: e.name, context: e.context ?? null,
              })),
            })
          : Promise.resolve(),
        eventsResult.length > 0
          ? prisma.timelineEvent.createMany({
              data: eventsResult.map(e => ({
                reportId: report.id, dateText: e.dateText, dateSortKey: e.dateSortKey ?? null, event: e.event,
              })),
            })
          : Promise.resolve(),
        (redactionsJson || journalismComparisonJson || verificationChecklistJson)
          ? prisma.reportJournalism.upsert({
              where: { reportId: report.id },
              create: { reportId: report.id, redactions: redactionsJson, journalismComparison: journalismComparisonJson, verificationChecklist: verificationChecklistJson },
              update: { redactions: redactionsJson, journalismComparison: journalismComparisonJson, verificationChecklist: verificationChecklistJson },
            })
          : Promise.resolve(),
      ])
    }

    void logAction('report:upload', `${title} (${area})`)

    // Fire-and-forget: refresh area briefing after successful upload (non-blocking)
    if (analysis?.summary) {
      prisma.report.findMany({
        where: { area },
        select: { summary: true, metrics: true, insights: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }).then(reports => generateAreaBriefing(area, appMode, reports)).catch(() => {})
    }

    return NextResponse.json({ report, hasPrevious: !!previousReport, seriesCandidate })
  } catch (e) {
    console.error('Upload error:', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

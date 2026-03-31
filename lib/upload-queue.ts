/**
 * Background upload queue — runs AI analysis after file transfer completes.
 * Jobs are stored in DB (UploadJob + UploadJobItem) and processed one-at-a-time
 * by a single module-level worker, preventing parallel Ollama overload.
 */

import { prisma } from './db'
import { analyzeReport, compareReports, checkResolvedFlags, extractEntities, extractTimeline, detectRedactions, compareDocumentsJournalism, generateVerificationChecklist, generateAreaBriefing } from './ai'
import { getModeConfig } from './mode'

// ── Global worker state ──────────────────────────────────────────────────────
let _workerRunning = false

// ── Process a single job item ─────────────────────────────────────────────────
async function processItem(itemId: string): Promise<void> {
  const item = await prisma.uploadJobItem.findUnique({ where: { id: itemId } })
  if (!item) return

  await prisma.uploadJobItem.update({ where: { id: itemId }, data: { status: 'processing' } })

  try {
    const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
    const appMode = modeRow?.value ?? 'executive'

    let directName: string | undefined
    if (item.directReportId) {
      const direct = await prisma.directReport.findUnique({ where: { id: item.directReportId } })
      if (direct) directName = direct.name
    }

    // Find most recent prior report for same area/direct
    const previousReport = await prisma.report.findFirst({
      where: {
        area: item.area,
        ...(item.directReportId ? { directReportId: item.directReportId } : {}),
        summary: { not: null },
        metrics: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    })

    // AI analysis
    let analysis = null
    try {
      analysis = await analyzeReport(item.rawContent, item.title, item.area, directName, appMode)
    } catch (e) {
      console.error('[upload-queue] AI analysis failed:', e)
    }

    // Comparison + resolved flags in parallel
    let comparison = null
    let resolvedFlagsJson: string | null = null

    type PrevInsight = { type: string; text: string }
    await Promise.all([
      (async () => {
        if (!previousReport || !analysis || !previousReport.summary || !previousReport.metrics) return
        try {
          comparison = await compareReports(
            previousReport.summary, previousReport.metrics,
            analysis.summary, JSON.stringify(analysis.metrics),
            item.area, appMode
          )
        } catch (e) { console.error('[upload-queue] Comparison failed:', e) }
      })(),
      (async () => {
        if (!previousReport?.insights || !analysis) return
        try {
          const prevInsights: PrevInsight[] = JSON.parse(previousReport.insights)
          const prevFlags = prevInsights.filter(i => i.type === 'risk' || i.type === 'anomaly')
          if (prevFlags.length > 0) {
            const resolved = await checkResolvedFlags(prevFlags, item.rawContent, analysis.insights)
            if (resolved.length > 0) resolvedFlagsJson = JSON.stringify(resolved)
          }
        } catch (e) { console.error('[upload-queue] Resolved flags failed:', e) }
      })(),
    ])

    const report = await prisma.report.create({
      data: {
        title: item.title,
        fileName: item.fileName,
        fileType: item.fileType,
        fileSize: item.fileSizeBytes,
        rawContent: item.rawContent,
        displayContent: item.displayContent,
        filePath: item.savedFilePath,
        area: item.area,
        directReportId: item.directReportId || null,
        reportDate: item.reportDate ? new Date(item.reportDate) : null,
        summary: analysis?.summary?.trim() || null,
        metrics: analysis?.metrics ? JSON.stringify(analysis.metrics) : null,
        insights: analysis?.insights ? JSON.stringify(analysis.insights) : null,
        questions: analysis?.questions ? JSON.stringify(analysis.questions) : null,
        comparison: comparison ? JSON.stringify(comparison) : null,
        resolvedFlags: resolvedFlagsJson,
      },
    })

    // Mode-specific: entities, timeline, redactions, verification, journalism comparison
    const modeFeatures = getModeConfig(appMode).features
    if (modeFeatures.entities || modeFeatures.timeline || modeFeatures.redactions || modeFeatures.verification || modeFeatures.documentComparison) {
      let entitiesResult: Awaited<ReturnType<typeof extractEntities>> = []
      let eventsResult: Awaited<ReturnType<typeof extractTimeline>> = []
      let redactionsJson: string | null = null
      let journalismComparisonJson: string | null = null
      let verificationChecklistJson: string | null = null

      await Promise.all([
        (async () => {
          try { entitiesResult = await extractEntities(item.rawContent, item.title, item.area) }
          catch (e) { console.error('[upload-queue] Entity extraction failed:', e) }
        })(),
        (async () => {
          try { eventsResult = await extractTimeline(item.rawContent, item.title) }
          catch (e) { console.error('[upload-queue] Timeline extraction failed:', e) }
        })(),
        (async () => {
          try {
            const redactions = await detectRedactions(item.rawContent, item.title)
            if (redactions.length > 0) redactionsJson = JSON.stringify(redactions)
          } catch (e) { console.error('[upload-queue] Redaction detection failed:', e) }
        })(),
        (async () => {
          if (!previousReport?.rawContent || previousReport.rawContent.trim().length <= 10) return
          try {
            const jComp = await compareDocumentsJournalism(
              previousReport.rawContent, previousReport.title, item.rawContent, item.title
            )
            journalismComparisonJson = JSON.stringify(jComp)
          } catch (e) { console.error('[upload-queue] Journalism comparison failed:', e) }
        })(),
        (async () => {
          try {
            const checklist = await generateVerificationChecklist(item.rawContent, item.title, item.area)
            if (checklist.length > 0) verificationChecklistJson = JSON.stringify(checklist)
          } catch (e) { console.error('[upload-queue] Verification checklist failed:', e) }
        })(),
      ])

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

    // Fire-and-forget: refresh area briefing
    if (analysis?.summary) {
      prisma.report.findMany({
        where: { area: item.area },
        select: { summary: true, metrics: true, insights: true, createdAt: true },
        orderBy: { createdAt: 'desc' }, take: 20,
      }).then(reports => generateAreaBriefing(item.area, appMode, reports)).catch(() => {})
    }

    await prisma.uploadJobItem.update({
      where: { id: itemId },
      data: { status: 'done', reportId: report.id },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[upload-queue] Item failed:', msg)
    await prisma.uploadJobItem.update({
      where: { id: itemId },
      data: { status: 'error', error: msg.slice(0, 500) },
    }).catch(() => {})
  }
}

// ── Worker loop ──────────────────────────────────────────────────────────────
async function runWorker(): Promise<void> {
  if (_workerRunning) return
  _workerRunning = true

  try {
    while (true) {
      // Find next queued item across all active jobs
      const item = await prisma.uploadJobItem.findFirst({
        where: { status: 'queued' },
        orderBy: [{ job: { createdAt: 'asc' } }, { sortOrder: 'asc' }],
        include: { job: true },
      })

      if (!item) break  // Queue empty — exit worker

      // Mark job as processing
      await prisma.uploadJob.update({
        where: { id: item.jobId },
        data: { status: 'processing' },
      })

      await processItem(item.id)

      // Increment job progress counter
      const job = await prisma.uploadJob.update({
        where: { id: item.jobId },
        data: { processed: { increment: 1 } },
      })

      // If all items done, mark job as done (or error if any failed)
      const remaining = await prisma.uploadJobItem.count({
        where: { jobId: item.jobId, status: 'queued' },
      })
      const hasErrors = await prisma.uploadJobItem.count({
        where: { jobId: item.jobId, status: 'error' },
      })

      if (remaining === 0) {
        await prisma.uploadJob.update({
          where: { id: item.jobId },
          data: { status: hasErrors > 0 && job.processed < job.total ? 'error' : 'done' },
        })
      }
    }
  } catch (err) {
    console.error('[upload-queue] Worker crashed:', err)
  } finally {
    _workerRunning = false
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export function kickWorker(): void {
  // Schedule worker to start after current tick so caller can return response first
  setImmediate(() => { runWorker().catch(e => console.error('[upload-queue] Worker error:', e)) })
}

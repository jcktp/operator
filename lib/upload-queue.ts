/**
 * Background upload queue — runs AI analysis after file transfer completes.
 * Jobs are stored in DB (UploadJob + UploadJobItem) and processed one-at-a-time
 * by a single module-level worker, preventing parallel Ollama overload.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { Ollama } from 'ollama'
import { prisma } from './db'
import { loadAiSettings } from './settings'
import { analyzeReport, compareReports, checkResolvedFlags, extractEntities, extractTimeline, detectRedactions, compareDocumentsJournalism, generateVerificationChecklist, generateAreaBriefing } from './ai'
import { getModeConfig } from './mode'
import { describeImage, transcribeAudio } from './ai-vision'
import { getMimeType, normalizeContent } from './parsers'
import { getReportsRoot } from './reports-folder'
import { routeVisionModel, routeAudioModel } from './model-capabilities'

// ── Global worker state ──────────────────────────────────────────────────────
let _workerRunning = false

// ── Process a single job item ─────────────────────────────────────────────────
async function processItem(itemId: string): Promise<void> {
  let item = await prisma.uploadJobItem.findUnique({ where: { id: itemId } })
  if (!item) return

  const setStep = (step: string) =>
    prisma.uploadJobItem.update({ where: { id: itemId }, data: { step } }).catch(() => {})

  // Mark as processing — step update is best-effort so a missing column never kills the job
  await prisma.uploadJobItem.update({ where: { id: itemId }, data: { status: 'processing' } })
  setStep('Starting…')

  try {
    // Reload AI settings so provider/model env vars are current
    await loadAiSettings()

    // ── Audio transcription ───────────────────────────────────────────────────
    if (item.displayContent?.startsWith('audio:') && item.rawContent.startsWith('[Audio') && item.savedFilePath) {
      await setStep('Transcribing audio…')
      try {
        // displayContent format: 'audio:area/file.ext\naudio/mpeg'
        const lines = item.displayContent.split('\n')
        const mimeType = lines[1]?.trim() || 'audio/mpeg'
        const fullPath = join(getReportsRoot(), item.savedFilePath)
        const buffer = readFileSync(fullPath)
        const transcript = await transcribeAudio(buffer, mimeType, item.fileName)
        if (transcript && !transcript.startsWith('[Audio transcription')) {
          await prisma.uploadJobItem.update({
            where: { id: itemId },
            data: { rawContent: transcript },
          })
          item = { ...item, rawContent: transcript }
        } else {
          // Transcription failed — surface the error in the report rawContent
          await prisma.uploadJobItem.update({
            where: { id: itemId },
            data: { rawContent: transcript || '[Audio transcription returned no text]' },
          })
          item = { ...item, rawContent: transcript || '[Audio transcription returned no text]' }
        }
      } catch (e) {
        console.error('[upload-queue] Audio transcription failed:', e)
      }
    }

    // ── Vision analysis for image items ──────────────────────────────────────
    // describeImage is called here (not in the HTTP route) so model-swap latency
    // doesn't block the upload response.
    let extractText = false
    if (item.displayContent?.startsWith('image:') && item.rawContent.startsWith('[Image') && item.savedFilePath) {
      await setStep('Describing image…')
      try {
        const metaStr = item.displayContent.split('\n').slice(1).join('\n')
        if (metaStr) {
          const meta = JSON.parse(metaStr) as Record<string, string>
          extractText = meta['_ocr'] === 'true'
        }
      } catch { /* no metadata */ }

      try {
        const fullPath = join(getReportsRoot(), item.savedFilePath)
        const buffer = readFileSync(fullPath)
        const mimeType = getMimeType(item.fileType.toLowerCase())
        const raw = await describeImage(buffer, mimeType, extractText)
        // Normalise OCR output — removes page numbers, decorators, repeated headers, and
        // collapses whitespace so the text model gets clean input for structured analysis.
        const description = extractText && !raw.startsWith('[') ? normalizeContent(raw) : raw
        // Update rawContent in DB so UI reflects the result immediately
        await prisma.uploadJobItem.update({
          where: { id: itemId },
          data: { rawContent: description },
        })
        item = { ...item, rawContent: description }
      } catch (e) {
        console.error('[upload-queue] Vision analysis failed:', e)
      }
    }

    const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
    const appMode = modeRow?.value ?? 'executive'

    let directName: string | undefined
    if (item.directReportId) {
      const direct = await prisma.directReport.findUnique({ where: { id: item.directReportId } })
      if (direct) directName = direct.name
    }

    // Find most recent prior report for same area/direct — scoped to project if one is set
    const previousReport = await prisma.report.findFirst({
      where: {
        area: item.area,
        ...(item.directReportId ? { directReportId: item.directReportId } : {}),
        ...(item.projectId ? { projectId: item.projectId } : {}),
        summary: { not: null },
        metrics: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Skip AI analysis for photos (vision description only) — only analyse OCR'd text from document images
    // Also skip if audio transcription failed (rawContent still starts with '[Audio')
    const isImagePlaceholder = item.displayContent?.startsWith('image:') && (!extractText || item.rawContent.startsWith('['))
    const isFailedAudio = item.displayContent?.startsWith('audio:') && item.rawContent.startsWith('[Audio')

    // AI analysis
    let analysis = null
    if (!isImagePlaceholder && !isFailedAudio) {
      await setStep('Analysing document…')
      try {
        analysis = await analyzeReport(item.rawContent, item.title, item.area, directName, appMode)
      } catch (e) {
        console.error('[upload-queue] AI analysis failed:', e)
      }
    }

    // Comparison + resolved flags in parallel
    let comparison = null
    let resolvedFlagsJson: string | null = null

    type PrevInsight = { type: string; text: string }
    if (!isImagePlaceholder && !isFailedAudio) {
      if (previousReport) await setStep('Comparing with previous report…')
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
    }

    // Check if cancelled while AI was running — don't save the report
    const freshStatus = await prisma.uploadJobItem.findUnique({ where: { id: itemId }, select: { status: true } })
    if (freshStatus?.status === 'error') return

    const report = await prisma.report.create({
      data: {
        title: item.title,
        fileName: item.fileName,
        fileType: item.fileType,
        fileSize: item.fileSizeBytes,
        rawContent: item.rawContent,
        // Audio items: clear displayContent so the report page renders the transcript as text
        displayContent: item.displayContent?.startsWith('audio:') ? null : item.displayContent,
        // For image uploads, imagePath = relative path after 'image:' on the first line
        imagePath: item.displayContent?.startsWith('image:') ? item.displayContent.slice('image:'.length).split('\n')[0] : null,
        filePath: item.savedFilePath,
        area: item.area,
        directReportId: item.directReportId || null,
        reportDate: item.reportDate ? new Date(item.reportDate) : null,
        storyName: item.storyName || null,
        projectId: item.projectId || null,
        summary: analysis?.summary?.trim() || null,
        metrics: analysis?.metrics ? JSON.stringify(analysis.metrics) : null,
        insights: analysis?.insights ? JSON.stringify(analysis.insights) : null,
        questions: analysis?.questions ? JSON.stringify(analysis.questions) : null,
        comparison: comparison ? JSON.stringify(comparison) : null,
        resolvedFlags: resolvedFlagsJson,
      },
    })

    // Mode-specific: entities, timeline, redactions, verification, journalism comparison
    // Skip all of these for image placeholders — no real text content to analyse
    const modeFeatures = getModeConfig(appMode).features
    if (!isImagePlaceholder && !isFailedAudio && (modeFeatures.entities || modeFeatures.timeline || modeFeatures.redactions || modeFeatures.verification || modeFeatures.documentComparison)) {
      await setStep('Extracting insights…')
      let entitiesResult: Awaited<ReturnType<typeof extractEntities>> = []
      let eventsResult: Awaited<ReturnType<typeof extractTimeline>> = []
      let redactionsJson: string | null = null
      let journalismComparisonJson: string | null = null
      let verificationChecklistJson: string | null = null

      await Promise.all([
        (async () => {
          if (!modeFeatures.entities) return
          try { entitiesResult = await extractEntities(item.rawContent, item.title, item.area) }
          catch (e) { console.error('[upload-queue] Entity extraction failed:', e) }
        })(),
        (async () => {
          if (!modeFeatures.timeline) return
          try { eventsResult = await extractTimeline(item.rawContent, item.title) }
          catch (e) { console.error('[upload-queue] Timeline extraction failed:', e) }
        })(),
        (async () => {
          if (!modeFeatures.redactions) return
          try {
            const redactions = await detectRedactions(item.rawContent, item.title)
            if (redactions.length > 0) redactionsJson = JSON.stringify(redactions)
          } catch (e) { console.error('[upload-queue] Redaction detection failed:', e) }
        })(),
        (async () => {
          if (!modeFeatures.documentComparison) return
          if (!previousReport?.rawContent || previousReport.rawContent.trim().length <= 10) return
          try {
            const jComp = await compareDocumentsJournalism(
              previousReport.rawContent, previousReport.title, item.rawContent, item.title
            )
            journalismComparisonJson = JSON.stringify(jComp)
          } catch (e) { console.error('[upload-queue] Journalism comparison failed:', e) }
        })(),
        (async () => {
          if (!modeFeatures.verification) return
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

    // Refresh area briefing synchronously so it completes before the queue
    // drains and the model is unloaded — prevents a reload cycle after eviction.
    if (analysis?.summary) {
      try {
        const areaReports = await prisma.report.findMany({
          where: { area: item.area },
          select: { summary: true, metrics: true, insights: true, createdAt: true },
          orderBy: { createdAt: 'desc' }, take: 20,
        })
        await generateAreaBriefing(item.area, appMode, areaReports)
      } catch (e) {
        console.error('[upload-queue] Area briefing failed:', e)
      }
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

// ── Ollama model unload ───────────────────────────────────────────────────────
// Sending keep_alive: 0 tells Ollama to evict models from memory immediately,
// freeing RAM/VRAM and stopping the fans after a batch upload completes.
// We unload all distinct models that may have been loaded during the job.
async function unloadOllamaModel(): Promise<void> {
  const provider = process.env.AI_PROVIDER ?? 'ollama'
  if (provider !== 'ollama') return
  try {
    const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
    const ollama = new Ollama({ host })

    const primary = process.env.OLLAMA_MODEL ?? 'phi4-mini'
    const vision = routeVisionModel()
    const audio = routeAudioModel()

    // Collect distinct model IDs that may be loaded
    const models = [...new Set([primary, vision, audio].filter(Boolean) as string[])]

    await Promise.allSettled(
      models.map(model => ollama.chat({ model, messages: [{ role: 'user', content: '' }], keep_alive: 0 }))
    )
  } catch {
    // Non-critical — models will unload on their own after Ollama's default timeout
  }
}

// ── Worker loop ──────────────────────────────────────────────────────────────
async function runWorker(): Promise<void> {
  if (_workerRunning) return
  _workerRunning = true

  try {
    // Recover items left in 'processing' by a previous server shutdown mid-job
    const stuck = await prisma.uploadJobItem.updateMany({
      where: { status: 'processing' },
      data: { status: 'queued' },
    })
    if (stuck.count > 0) {
      console.log(`[upload-queue] Recovered ${stuck.count} stuck item(s) to queued`)
      // Also un-stuck any parent jobs that were marked processing
      await prisma.uploadJob.updateMany({
        where: { status: 'processing', items: { some: { status: 'queued' } } },
        data: { status: 'queued' },
      })
    }

    while (true) {
      // Find next queued item across all active jobs
      const item = await prisma.uploadJobItem.findFirst({
        where: { status: 'queued' },
        orderBy: [{ job: { createdAt: 'asc' } }, { sortOrder: 'asc' }],
        include: { job: true },
      })

      if (!item) {
        // Queue empty — unload the model so it stops consuming RAM/CPU immediately
        unloadOllamaModel().catch(() => {})
        break
      }

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
        const doneCount = await prisma.uploadJobItem.count({
          where: { jobId: item.jobId, status: 'done' },
        })
        await prisma.uploadJob.update({
          where: { id: item.jobId },
          data: { status: hasErrors > 0 && doneCount === 0 ? 'error' : 'done' },
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

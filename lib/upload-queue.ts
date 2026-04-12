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
import { analyzeReport, compareReports, checkResolvedFlags, extractMerged, compareDocumentsJournalism, generateAreaBriefing } from './ai'
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

    // Check if cancelled while AI was running — don't save the report
    const freshStatus = await prisma.uploadJobItem.findUnique({ where: { id: itemId }, select: { status: true } })
    if (freshStatus?.status === 'error') return

    // Save the report immediately so it's visible in the UI while enrichment runs
    const report = await prisma.report.create({
      data: {
        title: item.title,
        fileName: item.fileName,
        fileType: item.fileType,
        fileSize: item.fileSizeBytes,
        rawContent: item.rawContent,
        displayContent: item.displayContent?.startsWith('audio:') ? null : item.displayContent,
        imagePath: item.displayContent?.startsWith('image:') ? item.displayContent.slice('image:'.length).split('\n')[0] : null,
        filePath: item.savedFilePath,
        area: item.area,
        mode: appMode,
        directReportId: item.directReportId || null,
        reportDate: item.reportDate ? new Date(item.reportDate) : null,
        storyName: item.storyName || null,
        projectId: item.projectId || null,
        summary: analysis?.summary?.trim() || null,
        metrics: analysis?.metrics ? JSON.stringify(analysis.metrics) : null,
        insights: analysis?.insights ? JSON.stringify(analysis.insights) : null,
        questions: analysis?.questions ? JSON.stringify(analysis.questions) : null,
        comparison: null,
        resolvedFlags: null,
      },
    })

    // ── Enrichment: comparison, resolved flags, mode features ────────────────
    // Each runs as a separate sequential AI call for Ollama (one model at a time).
    // Merged extraction combines entities+timeline+redactions+verification into
    // a single prompt so Ollama reads the document once instead of 4 times.
    const modeFeatures = getModeConfig(appMode).features
    let comparison = null
    let resolvedFlagsJson: string | null = null
    let journalismComparisonJson: string | null = null

    type PrevInsight = { type: string; text: string }

    if (!isImagePlaceholder && !isFailedAudio) {
      // Step 1: Comparison with previous report (if exists)
      if (previousReport && analysis && previousReport.summary && previousReport.metrics) {
        await setStep('Comparing with previous report…')
        try {
          comparison = await compareReports(
            previousReport.summary, previousReport.metrics,
            analysis.summary, JSON.stringify(analysis.metrics),
            item.area, appMode
          )
        } catch (e) { console.error('[upload-queue] Comparison failed:', e) }
      }

      // Step 2: Resolved flags check (if previous had risk/anomaly flags)
      if (previousReport?.insights && analysis) {
        try {
          const prevInsights: PrevInsight[] = JSON.parse(previousReport.insights)
          const prevFlags = prevInsights.filter(i => i.type === 'risk' || i.type === 'anomaly')
          if (prevFlags.length > 0) {
            const resolved = await checkResolvedFlags(prevFlags, item.rawContent, analysis.insights)
            if (resolved.length > 0) resolvedFlagsJson = JSON.stringify(resolved)
          }
        } catch (e) { console.error('[upload-queue] Resolved flags failed:', e) }
      }

      // Update report with comparison data
      if (comparison || resolvedFlagsJson) {
        await prisma.report.update({
          where: { id: report.id },
          data: {
            comparison: comparison ? JSON.stringify(comparison) : null,
            resolvedFlags: resolvedFlagsJson,
          },
        })
      }

      // Step 3: Merged extraction — one AI call for entities+timeline+redactions+verification
      const needsMerged = modeFeatures.entities || modeFeatures.timeline || modeFeatures.redactions || modeFeatures.verification
      if (needsMerged) {
        await setStep('Extracting insights…')
        try {
          const merged = await extractMerged(item.rawContent, item.title, item.area, {
            entities: !!modeFeatures.entities,
            timeline: !!modeFeatures.timeline,
            redactions: !!modeFeatures.redactions,
            verification: !!modeFeatures.verification,
          })

          await Promise.all([
            merged.entities.length > 0
              ? prisma.reportEntity.createMany({
                  data: merged.entities.map(e => ({
                    reportId: report.id, type: e.type, name: e.name, context: e.context ?? null,
                  })),
                })
              : Promise.resolve(),
            merged.events.length > 0
              ? prisma.timelineEvent.createMany({
                  data: merged.events.map(e => ({
                    reportId: report.id, dateText: e.dateText, dateSortKey: e.dateSortKey ?? null, event: e.event,
                  })),
                })
              : Promise.resolve(),
            (merged.redactions.length > 0 || merged.verification.length > 0)
              ? prisma.reportJournalism.upsert({
                  where: { reportId: report.id },
                  create: {
                    reportId: report.id,
                    redactions: merged.redactions.length > 0 ? JSON.stringify(merged.redactions) : null,
                    verificationChecklist: merged.verification.length > 0 ? JSON.stringify(merged.verification) : null,
                  },
                  update: {
                    redactions: merged.redactions.length > 0 ? JSON.stringify(merged.redactions) : null,
                    verificationChecklist: merged.verification.length > 0 ? JSON.stringify(merged.verification) : null,
                  },
                })
              : Promise.resolve(),
          ])
        } catch (e) { console.error('[upload-queue] Merged extraction failed:', e) }
      }

      // Step 4: Document comparison (separate call — needs both docs in prompt)
      if (modeFeatures.documentComparison && previousReport?.rawContent && previousReport.rawContent.trim().length > 10) {
        try {
          const jComp = await compareDocumentsJournalism(
            previousReport.rawContent, previousReport.title, item.rawContent, item.title
          )
          journalismComparisonJson = JSON.stringify(jComp)
          await prisma.reportJournalism.upsert({
            where: { reportId: report.id },
            create: { reportId: report.id, journalismComparison: journalismComparisonJson },
            update: { journalismComparison: journalismComparisonJson },
          })
        } catch (e) { console.error('[upload-queue] Document comparison failed:', e) }
      }
    }

    // Risk Register: auto-create risks from AI insights, auto-resolve from resolvedFlags
    if (!isImagePlaceholder && !isFailedAudio && modeFeatures.riskRegister) {
      try {
        const riskInsights = analysis?.insights?.filter(i => i.type === 'risk') ?? []
        if (riskInsights.length > 0) {
          // Fetch existing open risk titles for this project to avoid duplicates
          const existingTitles = new Set(
            (await prisma.risk.findMany({
              where: { ...(item.projectId ? { projectId: item.projectId } : {}), status: { not: 'closed' } },
              select: { title: true },
            })).map(r => r.title.toLowerCase())
          )
          const toCreate = riskInsights.filter(i => !existingTitles.has(i.text.toLowerCase()))
          if (toCreate.length > 0) {
            await prisma.risk.createMany({
              data: toCreate.map(i => ({
                id:          crypto.randomUUID(),
                title:       i.text.length > 200 ? i.text.slice(0, 197) + '…' : i.text,
                description: `Auto-identified from: ${report.title}`,
                status:      'open',
                projectId:   item?.projectId || null,
              })),
            })
          }
        }

        // Auto-resolve open risks whose text matches flags resolved in this report
        if (resolvedFlagsJson) {
          const resolvedTexts: string[] = JSON.parse(resolvedFlagsJson)
          if (resolvedTexts.length > 0) {
            const openRisks = await prisma.risk.findMany({
              where: { status: 'open', ...(item.projectId ? { projectId: item.projectId } : {}) },
              select: { id: true, title: true },
            })
            const now = new Date()
            for (const risk of openRisks) {
              const matched = resolvedTexts.some(t =>
                risk.title.toLowerCase().includes(t.toLowerCase().slice(0, 40)) ||
                t.toLowerCase().includes(risk.title.toLowerCase().slice(0, 40))
              )
              if (matched) {
                await prisma.risk.update({
                  where: { id: risk.id },
                  data: { status: 'closed', resolvedAt: now },
                })
              }
            }
          }
        }
      } catch (e) { console.error('[upload-queue] Risk register sync failed:', e) }
    }

    // Claims Tracker: auto-populate from all analysis insights
    if (!isImagePlaceholder && !isFailedAudio && modeFeatures.claims && analysis?.insights?.length) {
      try {
        // Fetch existing claim texts for this report to avoid duplicates on re-analysis
        const existingTexts = new Set(
          (await prisma.claim.findMany({
            where: { reportId: report.id },
            select: { text: true },
          })).map(c => c.text.toLowerCase())
        )
        const toCreate = analysis.insights.filter(i => !existingTexts.has(i.text.toLowerCase()))
        if (toCreate.length > 0) {
          await prisma.claim.createMany({
            data: toCreate.map(i => ({
              id:         crypto.randomUUID(),
              text:       i.text.length > 500 ? i.text.slice(0, 497) + '…' : i.text,
              sourceType: 'document',
              status:     'unverified',
              notes:      i.type !== 'observation' ? `AI-flagged as: ${i.type}` : null,
              reportId:   report.id,
              projectId:  item?.projectId ?? null,
            })),
          })
        }
      } catch (e) { console.error('[upload-queue] Claims auto-populate failed:', e) }
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

// ── Deferred area briefing ──────────────────────────────────────────────────
// Runs once after the entire batch finishes, not after each document.
// Finds all distinct areas that received new reports and regenerates
// their briefing in a single sequential pass.
async function refreshBriefingsForBatch(): Promise<void> {
  try {
    const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
    const appMode = modeRow?.value ?? 'executive'

    // Find areas that have recent reports but stale or missing briefings
    const recentReports = await prisma.report.findMany({
      where: { summary: { not: null } },
      select: { area: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const areas = [...new Set(recentReports.map(r => r.area))]

    for (const area of areas) {
      const briefing = await prisma.areaBriefing.findFirst({ where: { area, mode: appMode } })
      const latestReport = await prisma.report.findFirst({
        where: { area, summary: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })
      // Skip if briefing is newer than the latest report
      if (briefing && latestReport && briefing.updatedAt >= latestReport.createdAt) continue

      const areaReports = await prisma.report.findMany({
        where: { area },
        select: { summary: true, metrics: true, insights: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      await generateAreaBriefing(area, appMode, areaReports)
    }
  } catch (e) {
    console.error('[upload-queue] Batch area briefing failed:', e)
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
        // Queue empty — refresh area briefings for all areas that got new documents,
        // then unload the model so it stops consuming RAM/CPU immediately.
        await refreshBriefingsForBatch()
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

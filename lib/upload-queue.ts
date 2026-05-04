/**
 * Background upload queue — orchestrates AI analysis after file transfers complete.
 * Jobs are stored in DB (UploadJob + UploadJobItem) and processed one-at-a-time
 * to prevent parallel Ollama overload.
 *
 * Per-item processing logic lives in upload-pipeline.ts.
 */

import { Ollama } from 'ollama'
import { prisma } from './db'
import { generateAreaBriefing } from './ai'
import { routeVisionModel, routeAudioModel } from './models/capabilities'
import { processItem } from './upload-pipeline'

// ── Global worker state ──────────────────────────────────────────────────────
let _workerRunning = false

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
    const appMode = modeRow?.value ?? 'journalism'

    // Find areas that have recent reports but stale or missing briefings
    const recentReports = await prisma.report.findMany({
      where: { summary: { not: null } },
      select: { area: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const areas = [...new Set(recentReports.map(r => r.area))]

    for (const area of areas) {
      const briefing = await prisma.areaBriefing.findUnique({ where: { area } })
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
      await prisma.uploadJob.update({
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

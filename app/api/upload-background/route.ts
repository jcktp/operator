/**
 * POST /api/upload-background
 * Accepts file upload, parses content immediately (fast), queues AI analysis as a
 * background job, and returns immediately with { jobId, itemId } so the client can navigate away.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { loadAiSettings } from '@/lib/settings'
import { extractContent, getFileType, IMAGE_TYPES, AUDIO_TYPES, getAudioMimeType } from '@/lib/parsers'
import { saveReportFile } from '@/lib/reports-folder'
import { kickWorker } from '@/lib/upload-queue'
import { join } from 'path'
import { extractImageMetadata } from '@/lib/image-metadata'
import { scanFile } from '@/lib/file-scan'
import { canTranscribeAudio, audioUnavailableReason } from '@/lib/model-capabilities'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string
    const area = formData.get('area') as string
    const directReportId = formData.get('directReportId') as string | null
    const reportDate = formData.get('reportDate') as string | null
    const jobId = formData.get('jobId') as string | null      // group multiple files into one job
    const storyName = formData.get('storyName') as string | null
    const projectId = formData.get('projectId') as string | null
    const sortOrder = parseInt(formData.get('sortOrder') as string ?? '0', 10)
    const extractText = formData.get('extractText') === 'true'

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    if (!area) return NextResponse.json({ error: 'Area is required' }, { status: 400 })

    await loadAiSettings()

    const fileType = getFileType(file.name)
    const buffer = Buffer.from(await file.arrayBuffer())
    const isImage = IMAGE_TYPES.has(fileType.toLowerCase())
    const isAudio = AUDIO_TYPES.has(fileType.toLowerCase())

    // Scan before saving or processing anything
    const scan = scanFile(buffer, file.name)
    if (!scan.safe) return NextResponse.json({ error: `File rejected: ${scan.reason}` }, { status: 422 })

    // Pre-flight: reject audio uploads when no audio-capable model is configured
    if (isAudio && !canTranscribeAudio()) {
      return NextResponse.json({ error: audioUnavailableReason() }, { status: 422 })
    }

    // Save file to disk (fast)
    let savedFileName = file.name
    let savedFilePath: string | null = null
    try {
      const fullPath = saveReportFile(buffer, file.name, area)
      savedFileName = fullPath.split('/').pop() ?? file.name
      savedFilePath = join(area, savedFileName)
    } catch (e) {
      console.warn('[upload-background] Could not save to reports folder:', e)
    }

    // Parse content (fast — just reading bytes, no AI)
    let rawContent: string
    let displayContent: string | null = null

    if (isAudio) {
      // Audio transcription is deferred to the background worker.
      // Store the mime type in displayContent so the worker can pass it to transcribeAudio.
      rawContent = `[Audio: ${file.name}]`
      displayContent = `audio:${join(area, savedFileName)}\n${getAudioMimeType(fileType)}`
    } else if (isImage) {
      // Vision analysis is deferred to the background worker so the upload response
      // is fast and model-swapping time doesn't block the HTTP request.
      rawContent = `[Image: ${file.name}]`
      const imagePath = `image:${join(area, savedFileName)}`
      const meta = await extractImageMetadata(buffer, file.name, file.size) ?? {}
      // Store OCR flag inside metadata so the worker can read it without a schema change
      if (extractText) meta['_ocr'] = 'true'
      displayContent = `${imagePath}\n${JSON.stringify(meta)}`
    } else {
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
    }

    // Create or find the job container
    let activeJobId = jobId
    if (!activeJobId) {
      const job = await prisma.uploadJob.create({
        data: { status: 'queued', total: 1 },
      })
      activeJobId = job.id
    } else {
      // Increment total for existing job
      await prisma.uploadJob.update({
        where: { id: activeJobId },
        data: { total: { increment: 1 } },
      })
    }

    // Create job item with extracted content
    const item = await prisma.uploadJobItem.create({
      data: {
        jobId: activeJobId,
        title,
        area,
        fileType,
        fileName: file.name,
        fileSizeBytes: file.size,
        rawContent,
        displayContent,
        directReportId: directReportId || null,
        reportDate: reportDate || null,
        storyName: storyName || null,
        projectId: projectId || null,
        savedFilePath,
        status: 'queued',
        sortOrder,
      },
    })

    // Kick the background worker (non-blocking — runs after this response is sent)
    kickWorker()

    return NextResponse.json({ jobId: activeJobId, itemId: item.id })
  } catch (err) {
    console.error('[upload-background] Error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

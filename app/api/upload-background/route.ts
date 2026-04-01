/**
 * POST /api/upload-background
 * Accepts file upload, parses content immediately (fast), queues AI analysis as a
 * background job, and returns immediately with { jobId, itemId } so the client can navigate away.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { loadAiSettings } from '@/lib/settings'
import { extractContent, getFileType, IMAGE_TYPES, getMimeType } from '@/lib/parsers'
import { describeImage } from '@/lib/ai'
import { saveReportFile } from '@/lib/reports-folder'
import { kickWorker } from '@/lib/upload-queue'
import { join } from 'path'

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
    const sortOrder = parseInt(formData.get('sortOrder') as string ?? '0', 10)
    const extractText = formData.get('extractText') === 'true'

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    if (!area) return NextResponse.json({ error: 'Area is required' }, { status: 400 })

    await loadAiSettings()

    const fileType = getFileType(file.name)
    const buffer = Buffer.from(await file.arrayBuffer())
    const isImage = IMAGE_TYPES.has(fileType.toLowerCase())

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

    if (isImage) {
      // For images, do vision analysis synchronously (much faster than full analysis)
      const mimeType = getMimeType(fileType)
      try {
        rawContent = await describeImage(buffer, mimeType, extractText)
        displayContent = `image:${join(area, savedFileName)}`
      } catch {
        rawContent = `[Image: ${file.name}]`
      }
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

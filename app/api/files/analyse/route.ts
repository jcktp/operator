import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join, resolve, basename, extname } from 'path'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { getReportsRoot } from '@/lib/reports-folder'
import { extractContent, getFileType, IMAGE_TYPES, AUDIO_TYPES } from '@/lib/parsers'
import { analyzeReport } from '@/lib/ai'
import { extractEntities, extractTimeline } from '@/lib/ai/journalism'
import { loadAiSettings } from '@/lib/settings'

const VIDEO_TYPES = new Set(['mp4', 'mov', 'avi', 'mkv'])

export async function POST(req: Request) {
  const authError = await requireAuth(req)
  if (authError) return authError

  const { relativePath } = await req.json() as { relativePath: string }
  if (!relativePath) return NextResponse.json({ error: 'relativePath required' }, { status: 400 })

  const root = getReportsRoot()
  const abs = resolve(join(root, relativePath))
  if (!abs.startsWith(root)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!existsSync(abs)) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const fileName = basename(abs)
  const fileType = getFileType(fileName).toLowerCase()

  // Block media types — tell client to redirect
  if (IMAGE_TYPES.has(fileType) || AUDIO_TYPES.has(fileType) || VIDEO_TYPES.has(fileType)) {
    return NextResponse.json({ error: 'media', mediaType: IMAGE_TYPES.has(fileType) ? 'image' : 'audio/video' }, { status: 422 })
  }

  // Check not already analysed
  const existing = await prisma.report.findFirst({ where: { filePath: relativePath } })
  if (existing) return NextResponse.json({ error: 'Already analysed', reportId: existing.id }, { status: 409 })

  const buffer = readFileSync(abs)
  const fileSize = buffer.length

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

  await loadAiSettings()

  // Infer area and title from path: {project}/{area}/{bucket}/{date}/{file}
  const segments = relativePath.split('/')
  const area = segments.length >= 2 ? segments[1] : 'General'
  const title = fileName.replace(/\.[^/.]+$/, '')

  const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  const appMode = modeRow?.value ?? 'journalism'

  let analysis = null
  try { analysis = await analyzeReport(rawContent, title, area, undefined, appMode) }
  catch (e) { console.error('AI analysis failed:', e) }

  const report = await prisma.report.create({
    data: {
      title,
      fileName,
      fileType,
      fileSize,
      rawContent,
      displayContent,
      area,
      filePath: relativePath,    // points to existing file — no copy made
      summary: analysis?.summary?.trim() || null,
      metrics: analysis?.metrics ? JSON.stringify(analysis.metrics) : null,
      insights: analysis?.insights ? JSON.stringify(analysis.insights) : null,
      questions: analysis?.questions ? JSON.stringify(analysis.questions) : null,
    },
  })

  // Extract entities and timeline in background (non-blocking)
  void Promise.all([
    extractEntities(rawContent, title, area).then(async entities => {
      for (const e of entities) {
        await prisma.reportEntity.create({ data: { reportId: report.id, name: e.name, type: e.type, context: e.context ?? null } }).catch(() => {})
      }
    }).catch(() => {}),
    extractTimeline(rawContent, title).catch(() => {}),
  ])

  return NextResponse.json({ report: { id: report.id, createdAt: report.createdAt } })
}

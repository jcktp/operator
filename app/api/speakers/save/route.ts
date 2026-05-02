import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { saveReportFile } from '@/lib/reports-folder'

interface Segment {
  speaker: string
  start: number
  end: number
  duration: number
  text?: string
}

interface SaveBody {
  projectId?: string           // optional — if omitted, saved under "General"
  area: string
  fileName: string
  diarization: {
    segments: Segment[]
    num_speakers: number
    duration: number
    language?: string
  }
  speakerNames: Record<string, string>  // e.g. {"Speaker 1": "John", "Speaker 2": "Jane"}
}

function buildTranscript(segments: Segment[], speakerNames: Record<string, string>): string {
  return segments
    .map(seg => {
      const name = speakerNames[seg.speaker] || seg.speaker
      const start = formatTime(seg.start)
      const end = formatTime(seg.end)
      return seg.text ? `[${start}–${end}] ${name}: ${seg.text}` : `[${start}–${end}] ${name}`
    })
    .join('\n')
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export async function POST(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const contentType = req.headers.get('content-type') ?? ''
  let audioBuffer: Buffer
  let body: SaveBody

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('audio') as Blob | null
    const metaRaw = formData.get('meta') as string | null
    if (!file || !metaRaw) {
      return NextResponse.json({ error: 'audio and meta are required' }, { status: 400 })
    }
    audioBuffer = Buffer.from(await file.arrayBuffer())
    body = JSON.parse(metaRaw) as SaveBody
    body.fileName = (file as File).name ?? body.fileName
  } else {
    return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 })
  }

  const { projectId, area, fileName, diarization, speakerNames } = body
  if (!area) {
    return NextResponse.json({ error: 'area is required' }, { status: 400 })
  }

  let projectName: string | undefined
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    projectName = project.name
  }

  // Save audio file to disk
  const filePath = saveReportFile(audioBuffer, fileName, area, projectName)

  // Build a human-readable transcript as rawContent
  const rawContent = buildTranscript(diarization.segments, speakerNames)

  // Store structured diarization data in displayContent for library playback
  const displayContent = `audio:${JSON.stringify({ filePath, diarization, speakerNames })}`

  const ext = fileName.split('.').pop()?.toLowerCase() ?? 'audio'

  const report = await prisma.report.create({
    data: {
      title: fileName.replace(/\.[^/.]+$/, ''),
      fileName,
      fileType: ext,
      fileSize: audioBuffer.length,
      rawContent,
      displayContent,
      filePath,
      area,
      projectId: projectId || null,
    },
  })

  return NextResponse.json({ reportId: report.id })
}

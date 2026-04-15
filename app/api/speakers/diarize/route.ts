import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getReportsRoot } from '@/lib/reports-folder'
import { join, resolve } from 'path'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

const MEDIA_SERVICE = 'http://127.0.0.1:5052'

interface DiarizeServiceResponse {
  segments: Array<{ speaker: string; start: number; end: number; duration: number }>
  num_speakers: number
  duration: number
  detail?: string
}

export async function POST(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const contentType = req.headers.get('content-type') ?? ''
  let audioPath: string
  let tempPath: string | null = null
  let numSpeakers: number | undefined

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('audio') as Blob | null
    if (!file) {
      return NextResponse.json({ error: 'audio is required' }, { status: 400 })
    }
    const raw = formData.get('numSpeakers')
    numSpeakers = raw ? parseInt(raw as string, 10) : undefined
    const ext = ((file as File).name ?? 'audio.mp3').split('.').pop() ?? 'mp3'
    tempPath = join(tmpdir(), `diarize_${randomUUID()}.${ext}`)
    const buf = Buffer.from(await file.arrayBuffer())
    writeFileSync(tempPath, buf)
    audioPath = tempPath
  } else {
    const body = await req.json() as { audioPath?: string; numSpeakers?: number }
    if (!body.audioPath) {
      return NextResponse.json({ error: 'audioPath is required' }, { status: 400 })
    }
    const root = getReportsRoot()
    const abs = resolve(join(root, body.audioPath))
    if (!abs.startsWith(resolve(root) + '/')) {
      return NextResponse.json({ error: 'Invalid audio path' }, { status: 400 })
    }
    audioPath = abs
    numSpeakers = body.numSpeakers
  }

  try {
    const payload: Record<string, unknown> = { audio_path: audioPath }
    if (numSpeakers && numSpeakers >= 2) payload.num_speakers = numSpeakers

    const res = await fetch(`${MEDIA_SERVICE}/diarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json() as DiarizeServiceResponse
    if (!res.ok) {
      return NextResponse.json({ error: data.detail ?? 'Diarization failed' }, { status: 422 })
    }
    return NextResponse.json(data)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException & { cause?: NodeJS.ErrnoException })?.cause?.code
    if (code === 'ECONNREFUSED') {
      return NextResponse.json(
        { error: 'Media service unavailable. Ensure start.sh is running.' },
        { status: 503 },
      )
    }
    throw err
  } finally {
    if (tempPath) {
      try { unlinkSync(tempPath) } catch {}
    }
  }
}

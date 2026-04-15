import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getReportsRoot } from '@/lib/reports-folder'
import { join, resolve } from 'path'
import { writeFileSync, mkdirSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

const ANALYSIS_SERVICE = 'http://127.0.0.1:5051'

interface ElaServiceResponse {
  score: number
  max_score: number
  verdict: string
  ela_image_base64: string
  detail?: string
}

export async function POST(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const contentType = req.headers.get('content-type') ?? ''
  let imagePath: string
  let tempPath: string | null = null

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('image') as Blob | null
    if (!file) {
      return NextResponse.json({ error: 'image is required' }, { status: 400 })
    }
    // Save to a temp file for the Python service
    const ext = ((file as File).name ?? 'image.jpg').split('.').pop() ?? 'jpg'
    tempPath = join(tmpdir(), `ela_${randomUUID()}.${ext}`)
    const buf = Buffer.from(await file.arrayBuffer())
    writeFileSync(tempPath, buf)
    imagePath = tempPath
  } else {
    const body = await req.json() as { imagePath?: string }
    if (!body.imagePath) {
      return NextResponse.json({ error: 'imagePath is required' }, { status: 400 })
    }
    const root = getReportsRoot()
    const abs = resolve(join(root, body.imagePath))
    if (!abs.startsWith(resolve(root) + '/')) {
      return NextResponse.json({ error: 'Invalid image path' }, { status: 400 })
    }
    imagePath = abs
  }

  try {
    const res = await fetch(`${ANALYSIS_SERVICE}/ela`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_path: imagePath }),
    })
    const data = await res.json() as ElaServiceResponse
    if (!res.ok) {
      return NextResponse.json({ error: data.detail ?? 'ELA analysis failed' }, { status: 422 })
    }
    return NextResponse.json(data)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException & { cause?: NodeJS.ErrnoException })?.cause?.code
    if (code === 'ECONNREFUSED') {
      return NextResponse.json(
        { error: 'Analysis service unavailable. Ensure start.sh is running.' },
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

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getReportsRoot } from '@/lib/reports-folder'
import { computeEla } from '@/lib/image-forensics'
import { join, resolve } from 'path'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

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
    const result = await computeEla(imagePath)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'ELA analysis failed' },
      { status: 422 },
    )
  } finally {
    if (tempPath) {
      try { unlinkSync(tempPath) } catch {}
    }
  }
}

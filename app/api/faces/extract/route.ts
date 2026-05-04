import { NextResponse } from 'next/server'
import { join } from 'path'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { validateImagePath, serializeEmbedding, saveUploadedFaceImage } from '@/lib/media/face-utils'
import { getReportsRoot } from '@/lib/reports-folder'

const FACE_SERVICE = 'http://127.0.0.1:5050'

interface FaceServiceFace {
  id: string
  bbox: [number, number, number, number]
  embedding: number[]
}

interface FaceServiceExtractResponse {
  faces: FaceServiceFace[]
  detail?: string
}

export async function POST(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny

  let projectId: string
  let absPath: string
  let imageSource: string
  let documentId: string | undefined

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    projectId = (formData.get('projectId') as string | null) ?? ''
    documentId = (formData.get('documentId') as string | null) ?? undefined
    const file = formData.get('image') as Blob | null
    if (!projectId || !file) {
      return NextResponse.json({ error: 'projectId and image are required' }, { status: 400 })
    }
    const originalName = (file as File).name ?? 'upload.jpg'
    const saved = await saveUploadedFaceImage(file, originalName, projectId)
    absPath = saved.absolutePath
    imageSource = saved.relativePath
  } else {
    const body = await req.json() as { projectId?: string; imagePath?: string; documentId?: string }
    projectId = body.projectId ?? ''
    documentId = body.documentId
    const imagePath = body.imagePath ?? ''
    if (!projectId || !imagePath) {
      return NextResponse.json({ error: 'projectId and imagePath are required' }, { status: 400 })
    }
    absPath = join(getReportsRoot(), imagePath)
    if (!validateImagePath(absPath)) {
      return NextResponse.json({ error: 'Invalid image path' }, { status: 400 })
    }
    imageSource = imagePath
  }

  let serviceData: FaceServiceExtractResponse
  try {
    const serviceRes = await fetch(`${FACE_SERVICE}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_path: absPath }),
    })
    serviceData = await serviceRes.json() as FaceServiceExtractResponse
    if (!serviceRes.ok) {
      return NextResponse.json(
        { error: serviceData.detail ?? 'Face service error' },
        { status: 422 },
      )
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException & { cause?: NodeJS.ErrnoException })?.cause?.code
    if (code === 'ECONNREFUSED') {
      return NextResponse.json(
        { error: 'Face service unavailable. Ensure start.sh is running.' },
        { status: 503 },
      )
    }
    throw err
  }

  const saved = []
  for (const face of serviceData.faces) {
    const row = await prisma.faceEmbedding.create({
      data: {
        projectId,
        documentId: documentId ?? null,
        imageSource,
        bbox: JSON.stringify(face.bbox),
        embedding: serializeEmbedding(face.embedding),
      },
    })
    saved.push({
      id: row.id,
      projectId: row.projectId,
      documentId: row.documentId,
      imageSource: row.imageSource,
      bbox: row.bbox,
      createdAt: row.createdAt,
    })
  }

  return NextResponse.json({ faces: saved })
}

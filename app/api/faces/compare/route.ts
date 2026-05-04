import { NextResponse } from 'next/server'
import { join } from 'path'
import { requireAuth } from '@/lib/api-auth'
import { validateImagePath, saveUploadedFaceImage } from '@/lib/media/face-utils'
import { getReportsRoot } from '@/lib/reports-folder'

const FACE_SERVICE = 'http://127.0.0.1:5050'

interface FaceServiceCompareResponse {
  verified: boolean
  distance: number
  threshold: number
  model: string
  detail?: string
}

export async function POST(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny

  let projectId: string
  let absA: string
  let absB: string

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    projectId = (formData.get('projectId') as string | null) ?? ''
    const fileA = formData.get('imageA') as Blob | null
    const fileB = formData.get('imageB') as Blob | null
    if (!projectId || !fileA || !fileB) {
      return NextResponse.json(
        { error: 'projectId, imageA, and imageB are required' },
        { status: 400 },
      )
    }
    const nameA = (fileA as File).name ?? 'a.jpg'
    const nameB = (fileB as File).name ?? 'b.jpg'
    const savedA = await saveUploadedFaceImage(fileA, nameA, projectId)
    const savedB = await saveUploadedFaceImage(fileB, nameB, projectId)
    absA = savedA.absolutePath
    absB = savedB.absolutePath
  } else {
    const body = await req.json() as { projectId?: string; imageA?: string; imageB?: string }
    projectId = body.projectId ?? ''
    const imageA = body.imageA ?? ''
    const imageB = body.imageB ?? ''
    if (!projectId || !imageA || !imageB) {
      return NextResponse.json(
        { error: 'projectId, imageA, and imageB are required' },
        { status: 400 },
      )
    }
    const root = getReportsRoot()
    absA = join(root, imageA)
    absB = join(root, imageB)
    if (!validateImagePath(absA) || !validateImagePath(absB)) {
      return NextResponse.json({ error: 'Invalid image path' }, { status: 400 })
    }
  }

  let serviceData: FaceServiceCompareResponse
  try {
    const serviceRes = await fetch(`${FACE_SERVICE}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_a: absA, image_b: absB }),
    })
    serviceData = await serviceRes.json() as FaceServiceCompareResponse
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

  return NextResponse.json({
    verified: serviceData.verified,
    distance: serviceData.distance,
    threshold: serviceData.threshold,
    model: serviceData.model,
  })
}

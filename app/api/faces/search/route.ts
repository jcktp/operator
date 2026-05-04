import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { deserializeEmbedding, parseBbox, saveUploadedFaceImage, serializeEmbedding } from '@/lib/media/face-utils'

const FACE_SERVICE = 'http://127.0.0.1:5050'

interface ServiceMatch {
  id: string
  distance: number
}

interface ServiceSearchResponse {
  matches: ServiceMatch[]
  detail?: string
}

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
  let probe: number[]

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    // File upload path: extract probe embedding from the uploaded image first
    const formData = await req.formData()
    projectId = (formData.get('projectId') as string | null) ?? ''
    const file = formData.get('image') as Blob | null
    if (!projectId || !file) {
      return NextResponse.json({ error: 'projectId and image are required' }, { status: 400 })
    }
    const originalName = (file as File).name ?? 'probe.jpg'
    const saved = await saveUploadedFaceImage(file, originalName, projectId)

    // Extract embedding from probe image
    let extractData: FaceServiceExtractResponse
    try {
      const extractRes = await fetch(`${FACE_SERVICE}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_path: saved.absolutePath }),
      })
      extractData = await extractRes.json() as FaceServiceExtractResponse
      if (!extractRes.ok || !extractData.faces.length) {
        return NextResponse.json(
          { error: 'No face detected in probe image' },
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

    // Save the probe face so it appears in the case index
    const probeface = extractData.faces[0]
    await prisma.faceEmbedding.create({
      data: {
        projectId,
        imageSource: saved.relativePath,
        bbox: JSON.stringify(probeface.bbox),
        embedding: serializeEmbedding(probeface.embedding),
      },
    })
    probe = probeface.embedding
  } else {
    const body = await req.json() as {
      projectId?: string
      probeEmbedding?: number[]
      probeFaceId?: string
    }
    projectId = body.projectId ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }
    if (body.probeEmbedding) {
      probe = body.probeEmbedding
    } else if (body.probeFaceId) {
      const probeRow = await prisma.faceEmbedding.findUnique({ where: { id: body.probeFaceId } })
      if (!probeRow) {
        return NextResponse.json({ error: 'Probe face not found' }, { status: 404 })
      }
      probe = deserializeEmbedding(probeRow.embedding)
    } else {
      return NextResponse.json(
        { error: 'Either probeEmbedding or probeFaceId is required' },
        { status: 400 },
      )
    }
  }

  const rows = await prisma.faceEmbedding.findMany({ where: { projectId } })
  const candidates = rows.map((r) => ({
    id: r.id,
    embedding: deserializeEmbedding(r.embedding),
  }))

  let serviceData: ServiceSearchResponse
  try {
    const serviceRes = await fetch(`${FACE_SERVICE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ probe_embedding: probe, candidates }),
    })
    serviceData = await serviceRes.json() as ServiceSearchResponse
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

  const rowMap = new Map(rows.map((r) => [r.id, r]))
  const matches = serviceData.matches
    .map((m) => {
      const row = rowMap.get(m.id)
      if (!row) return null
      return {
        id: m.id,
        distance: m.distance,
        imageSource: row.imageSource,
        bbox: parseBbox(row.bbox),
        createdAt: row.createdAt,
      }
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)

  return NextResponse.json({ matches })
}

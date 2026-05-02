/**
 * Integration tests for the faces API routes.
 * Uses a real SQLite test database.
 * Stubs all face service HTTP calls — Python service not required to run.
 */
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { homedir } from 'os'
import { join } from 'path'
import { createTestClient } from '../helpers/db.js'

// ── DB mock ───────────────────────────────────────────────────────────────────
let _prisma: PrismaClient

vi.mock('@/lib/db', () => ({
  get prisma() { return _prisma },
}))

// ── reports-folder mock — deterministic root in tests ─────────────────────────
const MOCK_ROOT = join(homedir(), 'Documents', 'Operator Reports')
vi.mock('@/lib/reports-folder', () => ({
  getReportsRoot: () => MOCK_ROOT,
}))

// ── api-auth mock — controlled in each test ───────────────────────────────────
let _authAllow = true

vi.mock('@/lib/api-auth', () => ({
  requireAuth: vi.fn(async () => {
    if (_authAllow) return null
    const { NextResponse } = await import('next/server')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }),
}))

// ── Static imports after mocks ────────────────────────────────────────────────
import { POST as extractPOST } from '@/app/api/faces/extract/route'
import { POST as comparePOST } from '@/app/api/faces/compare/route'
import { POST as searchPOST } from '@/app/api/faces/search/route'

// ── Test lifecycle ─────────────────────────────────────────────────────────────
beforeAll(() => {
  _prisma = createTestClient()
})

afterAll(async () => {
  await _prisma.$disconnect()
})

beforeEach(async () => {
  _authAllow = true
  await _prisma.faceEmbedding.deleteMany()
  await _prisma.project.deleteMany()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/faces/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
}

async function createProject(): Promise<string> {
  const p = await _prisma.project.create({
    data: { name: 'Test Story' },
  })
  return p.id
}

// Valid image path that passes validateImagePath
function validImagePath(filename = 'photo.jpg'): string {
  return join(MOCK_ROOT, 'Test Story', 'Photos', filename)
}

// Relative path (as the API receives it)
function relImagePath(filename = 'photo.jpg'): string {
  return `Test Story/Photos/${filename}`
}

// Minimal ArcFace embedding (512 dims)
function fakeEmbedding(seed = 0): number[] {
  return Array.from({ length: 512 }, (_, i) => (seed + i) / 512)
}

// ── /api/faces/extract ────────────────────────────────────────────────────────

describe('POST /api/faces/extract', () => {
  it('returns 401 for unauthenticated requests', async () => {
    _authAllow = false
    const res = await extractPOST(makeRequest({ projectId: 'x', imagePath: 'y' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when projectId is missing', async () => {
    const res = await extractPOST(makeRequest({ imagePath: relImagePath() }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when imagePath is missing', async () => {
    const projectId = await createProject()
    const res = await extractPOST(makeRequest({ projectId }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a path traversal attempt', async () => {
    const projectId = await createProject()
    const res = await extractPOST(
      makeRequest({ projectId, imagePath: '../../../etc/passwd' }),
    )
    expect(res.status).toBe(400)
  })

  it('persists FaceEmbedding rows and returns face records without embeddings', async () => {
    const projectId = await createProject()

    // Stub fetch → face service returns two faces
    const stubbedFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        faces: [
          { id: 'uuid-1', bbox: [10, 20, 60, 70], embedding: fakeEmbedding(0) },
          { id: 'uuid-2', bbox: [100, 120, 55, 65], embedding: fakeEmbedding(1) },
        ],
      }),
    } as Response)
    vi.stubGlobal('fetch', stubbedFetch)

    const res = await extractPOST(
      makeRequest({ projectId, imagePath: relImagePath() }),
    )
    expect(res.status).toBe(200)

    const body = await res.json() as { faces: Array<{ id: string; embedding?: unknown }> }
    expect(body.faces).toHaveLength(2)

    // Embedding arrays must NOT be in the response
    for (const face of body.faces) {
      expect(face.embedding).toBeUndefined()
    }

    // Rows must be persisted in DB
    const rows = await _prisma.faceEmbedding.findMany({ where: { projectId } })
    expect(rows).toHaveLength(2)
    // Embeddings are stored as JSON strings in DB
    expect(typeof rows[0].embedding).toBe('string')
    const parsed = JSON.parse(rows[0].embedding) as number[]
    expect(parsed).toHaveLength(512)

    vi.unstubAllGlobals()
  })

  it('returns 503 when face service is unreachable', async () => {
    const projectId = await createProject()
    const connErr = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(connErr))

    const res = await extractPOST(
      makeRequest({ projectId, imagePath: relImagePath() }),
    )
    expect(res.status).toBe(503)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('Face service unavailable')

    vi.unstubAllGlobals()
  })
})

// ── /api/faces/search ─────────────────────────────────────────────────────────

describe('POST /api/faces/search', () => {
  it('returns 401 for unauthenticated requests', async () => {
    _authAllow = false
    const res = await searchPOST(makeRequest({ projectId: 'x', probeEmbedding: [] }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when projectId is missing', async () => {
    const res = await searchPOST(makeRequest({ probeEmbedding: fakeEmbedding() }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when neither probeEmbedding nor probeFaceId is provided', async () => {
    const projectId = await createProject()
    const res = await searchPOST(makeRequest({ projectId }))
    expect(res.status).toBe(400)
  })

  it('loads candidate embeddings from DB and returns matched face records', async () => {
    const projectId = await createProject()

    // Seed two face rows in DB
    const rowA = await _prisma.faceEmbedding.create({
      data: {
        projectId,
        imageSource: relImagePath('a.jpg'),
        bbox: '[10, 20, 60, 70]',
        embedding: JSON.stringify(fakeEmbedding(0)),
      },
    })
    const rowB = await _prisma.faceEmbedding.create({
      data: {
        projectId,
        imageSource: relImagePath('b.jpg'),
        bbox: '[50, 60, 55, 65]',
        embedding: JSON.stringify(fakeEmbedding(100)),
      },
    })

    // Stub face service to return rowA as a match
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        matches: [{ id: rowA.id, distance: 0.1 }],
      }),
    } as Response))

    const res = await searchPOST(
      makeRequest({ projectId, probeEmbedding: fakeEmbedding(0) }),
    )
    expect(res.status).toBe(200)

    const body = await res.json() as {
      matches: Array<{ id: string; imageSource: string; distance: number }>
    }
    expect(body.matches).toHaveLength(1)
    expect(body.matches[0].id).toBe(rowA.id)
    expect(body.matches[0].imageSource).toBe(relImagePath('a.jpg'))
    expect(typeof body.matches[0].distance).toBe('number')

    // Verify the candidate list sent to Python includes all project rows
    const fetchCall = (vi.mocked(fetch).mock.calls[0] as [string, RequestInit])
    const payload = JSON.parse(fetchCall[1].body as string) as {
      candidates: Array<{ id: string }>
    }
    const candidateIds = payload.candidates.map((c) => c.id)
    expect(candidateIds).toContain(rowA.id)
    expect(candidateIds).toContain(rowB.id)

    vi.unstubAllGlobals()
  })

  it('looks up embedding by probeFaceId when probeEmbedding is not provided', async () => {
    const projectId = await createProject()

    const probeRow = await _prisma.faceEmbedding.create({
      data: {
        projectId,
        imageSource: relImagePath('probe.jpg'),
        bbox: '[0, 0, 50, 50]',
        embedding: JSON.stringify(fakeEmbedding(0)),
      },
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ matches: [] }),
    } as Response))

    const res = await searchPOST(
      makeRequest({ projectId, probeFaceId: probeRow.id }),
    )
    expect(res.status).toBe(200)

    // Verify the probe_embedding was passed to the face service
    const fetchCall = (vi.mocked(fetch).mock.calls[0] as [string, RequestInit])
    const payload = JSON.parse(fetchCall[1].body as string) as {
      probe_embedding: number[]
    }
    expect(payload.probe_embedding).toHaveLength(512)

    vi.unstubAllGlobals()
  })
})

// ── /api/faces/compare ────────────────────────────────────────────────────────

describe('POST /api/faces/compare', () => {
  it('returns 401 for unauthenticated requests', async () => {
    _authAllow = false
    const res = await comparePOST(
      makeRequest({ projectId: 'x', imageA: 'a.jpg', imageB: 'b.jpg' }),
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 for a path traversal in imageA', async () => {
    const projectId = await createProject()
    const res = await comparePOST(
      makeRequest({
        projectId,
        imageA: '../../../etc/passwd',
        imageB: relImagePath('b.jpg'),
      }),
    )
    expect(res.status).toBe(400)
  })
})

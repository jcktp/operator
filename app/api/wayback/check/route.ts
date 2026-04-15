import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

interface WaybackAvailableResponse {
  archived_snapshots: {
    closest?: {
      status: string
      available: boolean
      url: string
      timestamp: string
    }
  }
}

function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    .finally(() => clearTimeout(id))
}

export async function GET(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: 'Only http/https URLs are supported' }, { status: 400 })
  }

  // Run both archive.org calls in parallel with a 10 s timeout each
  const availPromise = fetchWithTimeout(
    `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
    10_000,
  )
    .then(r => r.json() as Promise<WaybackAvailableResponse>)
    .catch(() => null)

  const cdxPromise = fetchWithTimeout(
    `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=20&fl=timestamp,original,statuscode,mimetype&collapse=timestamp:8`,
    10_000,
  )
    .then(r => r.json() as Promise<string[][]>)
    .catch(() => null)

  const [availData, cdxRaw] = await Promise.all([availPromise, cdxPromise])

  const closest = availData?.archived_snapshots?.closest

  const snapshots: Array<{ timestamp: string; url: string; statusCode: string; mimetype: string }> = []
  if (Array.isArray(cdxRaw) && cdxRaw.length > 1) {
    for (let i = 1; i < cdxRaw.length; i++) {
      const [timestamp, , statusCode, mimetype] = cdxRaw[i] as string[]
      snapshots.push({ timestamp, url, statusCode, mimetype })
    }
  }

  return NextResponse.json({
    available: {
      url,
      closest: closest
        ? {
            status: closest.status,
            available: closest.available,
            url: closest.url,
            timestamp: closest.timestamp,
          }
        : undefined,
    },
    snapshots,
  })
}

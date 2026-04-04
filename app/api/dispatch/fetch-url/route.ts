import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

const MAX_CHARS = 8000

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { url } = await req.json()
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Operator/1.0)' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 400 })
    }
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text') && !contentType.includes('html') && !contentType.includes('json')) {
      return NextResponse.json({ error: 'URL does not return readable text content' }, { status: 400 })
    }
    const text = await res.text()
    // Strip HTML tags and collapse whitespace
    const clean = text
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_CHARS)
    return NextResponse.json({ content: clean, url })
  } catch (e) {
    return NextResponse.json({ error: `Could not fetch URL: ${String(e)}` }, { status: 400 })
  }
}

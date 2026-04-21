import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { searchUsername } from '@/lib/username-search'

export async function GET(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username')?.trim()

  if (!username) {
    return NextResponse.json({ error: 'username is required' }, { status: 400 })
  }

  // Basic validation — alphanumeric, underscores, hyphens, dots, 1-64 chars
  if (!/^[\w.\-]{1,64}$/.test(username)) {
    return NextResponse.json(
      { error: 'Invalid username — only letters, numbers, underscores, hyphens, and dots are allowed (max 64 chars)' },
      { status: 400 },
    )
  }

  const skipNsfw = searchParams.get('nsfw') !== 'true'

  const stream = searchUsername(username, { skipNsfw })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    },
  })
}

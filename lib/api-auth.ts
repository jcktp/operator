import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE } from './auth'
import { isValidSession } from './auth'

/**
 * Auth guard for API routes.
 * Accepts both NextRequest (standard) and plain Request (used by some route handlers).
 * Returns a 401 response if the session is invalid, null if the request is authorised.
 */
export async function requireAuth(req: NextRequest | Request): Promise<NextResponse | null> {
  let token: string | undefined

  if (req instanceof NextRequest) {
    token = req.cookies.get(SESSION_COOKIE)?.value
  } else {
    // Parse cookie header for route handlers typed as plain Request
    const cookieHeader = req.headers.get('cookie') ?? ''
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`))
    token = match ? decodeURIComponent(match[1]) : undefined
  }

  if (!(await isValidSession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

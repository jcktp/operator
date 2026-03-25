import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/health', '/request/', '/starting', '/api/startup-status', '/api/report-requests/']

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths through unconditionally
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const session = req.cookies.get('op_session')?.value
  if (!session) {
    // API routes get a 401 JSON; page routes redirect to login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
}

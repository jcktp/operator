import { NextRequest, NextResponse } from 'next/server'
import { isValidSession } from './auth'

/** Full DB session validation for destructive API routes. Returns a 401 response if unauthorized, null if ok. */
export async function requireAuth(req: NextRequest): Promise<NextResponse | null> {
  const token = req.cookies.get('op_session')?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

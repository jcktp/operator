import { NextResponse } from 'next/server'

/** Typed API error with HTTP status code */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Standardized error response handler for API routes */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error('Unhandled API error:', e)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

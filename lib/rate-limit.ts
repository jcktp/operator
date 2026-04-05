/**
 * Simple in-memory rate limiter for Ollama-backed endpoints.
 * Only applied when AI_PROVIDER is 'ollama' — cloud providers have their own limits.
 *
 * Uses a sliding window counter keyed by session token (from cookie).
 * State lives in the process — resets on server restart, which is fine for single-user local use.
 */
import { NextRequest, NextResponse } from 'next/server'

interface Window {
  count: number
  windowStart: number
}

const store = new Map<string, Window>()

export interface RateLimitConfig {
  maxRequests: number   // max requests allowed in the window
  windowMs: number      // window size in milliseconds
}

/**
 * Returns a 429 NextResponse if the request exceeds the rate limit, otherwise null.
 * Only enforces limits when AI_PROVIDER === 'ollama'.
 */
export function checkRateLimit(req: NextRequest, config: RateLimitConfig): NextResponse | null {
  if (process.env.AI_PROVIDER !== 'ollama') return null

  const token = req.cookies.get('session')?.value ?? req.headers.get('x-forwarded-for') ?? 'default'
  const now = Date.now()
  const entry = store.get(token)

  if (!entry || now - entry.windowStart > config.windowMs) {
    store.set(token, { count: 1, windowStart: now })
    return null
  }

  entry.count++
  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((config.windowMs - (now - entry.windowStart)) / 1000)
    return NextResponse.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  return null
}

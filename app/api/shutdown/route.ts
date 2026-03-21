import { NextResponse } from 'next/server'

export async function POST() {
  // Respond first, then exit so the client receives the response
  setTimeout(() => {
    process.exit(0)
  }, 600)

  return NextResponse.json({ ok: true })
}

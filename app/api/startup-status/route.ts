import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'

export const dynamic = 'force-dynamic'

interface StartupStatus {
  step: string
  detail?: string
  ready: boolean
}

export async function GET() {
  try {
    const raw = readFileSync('/tmp/operator-startup.json', 'utf-8')
    const data = JSON.parse(raw) as StartupStatus
    return NextResponse.json(data)
  } catch {
    // File doesn't exist yet or is being written — still starting
    return NextResponse.json({ step: 'Starting up…', ready: false })
  }
}

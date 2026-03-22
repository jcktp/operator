import { NextResponse } from 'next/server'
import { isSetupComplete, getFailedAttempts, MAX_ATTEMPTS } from '@/lib/auth'

export async function GET() {
  try {
    const setup = await isSetupComplete()
    const attempts = await getFailedAttempts()
    return NextResponse.json({
      setupComplete: setup,
      failedAttempts: attempts,
      attemptsLeft: MAX_ATTEMPTS - attempts,
    })
  } catch {
    // DB not ready yet (e.g. migrations haven't run) — treat as fresh install
    return NextResponse.json({
      setupComplete: false,
      failedAttempts: 0,
      attemptsLeft: MAX_ATTEMPTS,
      dbError: true,
    })
  }
}

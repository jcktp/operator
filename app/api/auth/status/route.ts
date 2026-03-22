import { NextResponse } from 'next/server'
import { isSetupComplete, getFailedAttempts, MAX_ATTEMPTS } from '@/lib/auth'

export async function GET() {
  const setup = await isSetupComplete()
  const attempts = await getFailedAttempts()
  return NextResponse.json({
    setupComplete: setup,
    failedAttempts: attempts,
    attemptsLeft: MAX_ATTEMPTS - attempts,
  })
}

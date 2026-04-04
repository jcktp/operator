import { NextResponse , NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { loadAiSettings } from '@/lib/settings'
import { canTranscribeAudio, audioUnavailableReason } from '@/lib/model-capabilities'

export async function GET(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny
  await loadAiSettings()
  const capable = canTranscribeAudio()
  return NextResponse.json({
    capable,
    reason: capable ? null : audioUnavailableReason(),
  })
}

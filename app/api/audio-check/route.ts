import { NextResponse } from 'next/server'
import { loadAiSettings } from '@/lib/settings'
import { canTranscribeAudio, audioUnavailableReason } from '@/lib/model-capabilities'

export async function GET() {
  await loadAiSettings()
  const capable = canTranscribeAudio()
  return NextResponse.json({
    capable,
    reason: capable ? null : audioUnavailableReason(),
  })
}

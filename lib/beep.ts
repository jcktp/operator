type AudioContextConstructor = typeof AudioContext

function getAudioContext(): AudioContext | null {
  try {
    const Ctx: AudioContextConstructor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: AudioContextConstructor }).webkitAudioContext
    return new Ctx()
  } catch {
    return null
  }
}

function tone(
  ctx: AudioContext,
  startFreq: number,
  endFreq: number,
  startTime: number,
  duration: number,
  volume = 0.22,
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.type = 'sine'
  osc.frequency.setValueAtTime(startFreq, startTime)
  osc.frequency.linearRampToValueAtTime(endFreq, startTime + duration * 0.85)

  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.015)
  gain.gain.setValueAtTime(volume, startTime + duration - 0.06)
  gain.gain.linearRampToValueAtTime(0, startTime + duration)

  osc.start(startTime)
  osc.stop(startTime + duration + 0.02)
}

/**
 * Play the walkie-talkie startup beep (two quick ascending tones — "channel open").
 * Returns a promise that resolves once the sound finishes.
 */
export function playStartupBeep(): Promise<void> {
  return new Promise(resolve => {
    const ctx = getAudioContext()
    if (!ctx) { resolve(); return }
    const now = ctx.currentTime
    tone(ctx, 900,  1200, now,        0.14)
    tone(ctx, 1200, 1600, now + 0.18, 0.18)
    setTimeout(() => { ctx.close(); resolve() }, 600)
  })
}

/**
 * Play the walkie-talkie shutdown beep (one descending tone — "signing off").
 * Returns a promise that resolves once the sound finishes.
 */
export function playShutdownBeep(): Promise<void> {
  return new Promise(resolve => {
    const ctx = getAudioContext()
    if (!ctx) { resolve(); return }
    const now = ctx.currentTime
    tone(ctx, 1500, 800, now, 0.38)
    setTimeout(() => { ctx.close(); resolve() }, 600)
  })
}

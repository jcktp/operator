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

function rogerTone(ctx: AudioContext, freq: number, startTime: number, duration: number, volume = 0.18) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)

  // Square wave = classic buzzy walkie-talkie electronic tone (not a whistle)
  osc.type = 'square'
  osc.frequency.setValueAtTime(freq, startTime)

  // Hard click-in, short tail off
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01)
  gain.gain.setValueAtTime(volume, startTime + duration - 0.05)
  gain.gain.linearRampToValueAtTime(0, startTime + duration)

  osc.start(startTime)
  osc.stop(startTime + duration + 0.02)
}

/**
 * Startup beep — two short square-wave tones stepping up, like a channel opening.
 */
export function playStartupBeep(): Promise<void> {
  return new Promise(resolve => {
    const ctx = getAudioContext()
    if (!ctx) { resolve(); return }
    const now = ctx.currentTime
    rogerTone(ctx, 1050, now,        0.12)
    rogerTone(ctx, 1350, now + 0.16, 0.12)
    setTimeout(() => { ctx.close(); resolve() }, 500)
  })
}

/**
 * Shutdown beep — single classic Roger beep, flat tone, like end of transmission.
 */
export function playShutdownBeep(): Promise<void> {
  return new Promise(resolve => {
    const ctx = getAudioContext()
    if (!ctx) { resolve(); return }
    const now = ctx.currentTime
    rogerTone(ctx, 1100, now, 0.45)
    setTimeout(() => { ctx.close(); resolve() }, 650)
  })
}

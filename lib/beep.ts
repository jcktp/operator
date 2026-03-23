let audio: HTMLAudioElement | null = null

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!audio) audio = new Audio('/sounds/chirp.mp3')
  return audio
}

function isSoundEnabled(): boolean {
  try { return localStorage.getItem('sound_enabled') !== 'false' } catch { return true }
}

function playChirp(volume = 0.4): Promise<void> {
  return new Promise(resolve => {
    if (!isSoundEnabled()) { resolve(); return }
    const a = getAudio()
    if (!a) { resolve(); return }
    a.currentTime = 0
    a.volume = volume
    a.onended = () => resolve()
    a.play().catch(() => resolve())
  })
}

export function playStartupBeep(): Promise<void> {
  return playChirp(0.4)
}

export function playShutdownBeep(): Promise<void> {
  return playChirp(0.4)
}

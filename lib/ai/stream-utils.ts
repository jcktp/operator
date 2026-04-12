// ── Shared streaming utilities for AI providers ─────────────────────────────

export async function fetchWithRetry(url: string, init: RequestInit, maxAttempts = 3): Promise<Response> {
  let lastErr: unknown
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, init)
      if ((res.status === 429 || res.status >= 500) && i < maxAttempts - 1) {
        const retryAfter = res.headers.get('Retry-After')
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 1000 * 2 ** i
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      return res
    } catch (e) {
      lastErr = e
      if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, 1000 * 2 ** i))
    }
  }
  throw lastErr ?? new Error('fetch failed after retries')
}

export async function* sseLines(res: Response): AsyncGenerator<string> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) yield line
  }
  if (buf) yield buf
}

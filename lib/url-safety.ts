/** Block requests to internal/private IP ranges to prevent SSRF */
export function isInternalUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr)
    const hostname = parsed.hostname.toLowerCase()
    // Block localhost variants
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') return true
    // Block metadata endpoints
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') return true
    // Block private IP ranges
    const parts = hostname.split('.').map(Number)
    if (parts.length === 4 && parts.every(n => !isNaN(n))) {
      if (parts[0] === 10) return true                                              // 10.0.0.0/8
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true         // 172.16.0.0/12
      if (parts[0] === 192 && parts[1] === 168) return true                         // 192.168.0.0/16
      if (parts[0] === 0) return true                                               // 0.0.0.0/8
    }
    // Block non-http(s) schemes
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true
    return false
  } catch {
    return true
  }
}

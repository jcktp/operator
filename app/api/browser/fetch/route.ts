import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  const m =
    url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/) ??
    url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/)
  return m?.[1] ?? null
}

function extractSpotifyEmbed(url: string): string | null {
  // https://open.spotify.com/track/... → https://open.spotify.com/embed/track/...
  const m = url.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/)
  if (!m) return null
  return `https://open.spotify.com/embed/${m[1]}/${m[2]}`
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (!m) return ''
  return m[1]
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .trim()
}

function extractFavicon(html: string, baseUrl: string): string | null {
  const m = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i)
  if (!m) {
    try {
      const u = new URL(baseUrl)
      return `${u.origin}/favicon.ico`
    } catch { return null }
  }
  try {
    return new URL(m[1], baseUrl).href
  } catch { return m[1] }
}

// Make relative image src values absolute
function absolutifyImages(html: string, baseUrl: string): string {
  try {
    const origin = new URL(baseUrl).origin
    const base = new URL(baseUrl).href
    return html.replace(/(<img[^>]+src=["'])([^"']+)(["'])/gi, (_, pre, src, post) => {
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) return pre + src + post
      if (src.startsWith('//')) return pre + 'https:' + src + post
      if (src.startsWith('/')) return pre + origin + src + post
      try { return pre + new URL(src, base).href + post } catch { return pre + src + post }
    })
  } catch { return html }
}

// Remove dangerous attributes (event handlers, javascript: hrefs) from HTML
function sanitizeHtml(html: string): string {
  return html
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '')
    .replace(/href=["']javascript:[^"']*["']/gi, 'href="#"')
}

function extractReadableContent(html: string, pageUrl: string): { html: string; text: string } {
  let body = html

  // Prefer <article> or <main>
  const article = body.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1]
  const main    = body.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1]
  body = article ?? main ?? body

  // Strip noise blocks
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*>/gi, '')           // strip unclosed <script> open tags
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')

  // Make image sources absolute, then sanitize
  body = absolutifyImages(body, pageUrl)
  body = sanitizeHtml(body)

  // Trim to ~80 KB of HTML to avoid sending enormous pages
  const cleanedHtml = body.slice(0, 80_000)

  // Also produce plain text for AI context (strip all tags)
  const text = body
    .replace(/<img[^>]+>/gi, '')  // drop images from text version
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 20_000)

  return { html: cleanedHtml, text }
}

// ── Route ─────────────────────────────────────────────────────────────────────

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  if (process.env.AIR_GAP_MODE === 'true') {
    return NextResponse.json({ error: 'Air-gap mode is enabled — the browser is blocked.' }, { status: 403 })
  }
  try {
    const { url } = await req.json() as { url?: string }
    if (!url || !url.startsWith('http')) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }


    // YouTube video — only specific video URLs, not homepage/channel pages
    const ytId = extractYouTubeId(url)
    if (ytId) {
      return NextResponse.json({ type: 'youtube', videoId: ytId, url })
    }

    // Spotify track/album/playlist/etc
    const spotifyEmbed = extractSpotifyEmbed(url)
    if (spotifyEmbed) {
      return NextResponse.json({ type: 'spotify', embedUrl: spotifyEmbed, url })
    }

    // General page fetch — use browser-like headers to avoid bot detection
    let html: string
    try {
      const res = await fetch(url, {
        headers: {
          ...BROWSER_HEADERS,
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: AbortSignal.timeout(12_000),
        redirect: 'follow',
      })
      if (!res.ok) {
        const hint = res.status === 403
          ? 'Site blocked the request (bot protection or login required). Switch to Live mode to access it directly.'
          : res.status === 429
          ? 'Rate limited — try again in a moment, or switch to Live mode.'
          : res.status === 401 || res.status === 407
          ? 'Authentication required. Switch to Live mode to log in.'
          : `HTTP ${res.status}`
        return NextResponse.json({ type: 'error', error: hint, fallbackUrl: url })
      }
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('html')) {
        return NextResponse.json({ type: 'error', error: 'Not an HTML page — try Live mode or open in a tab.', fallbackUrl: url })
      }
      html = await res.text()
    } catch (e) {
      const msg = String(e).replace('Error: ', '')
      const hint = msg.includes('timeout') || msg.includes('TimeoutError')
        ? 'Request timed out. The site may be slow — try Live mode.'
        : msg
      return NextResponse.json({ type: 'error', error: hint, fallbackUrl: url })
    }

    const title = extractTitle(html)
    const favicon = extractFavicon(html, url)
    const { html: articleHtml, text } = extractReadableContent(html, url)

    return NextResponse.json({ type: 'article', title, favicon, html: articleHtml, text, url })
  } catch (e) {
    console.error('Browser fetch error:', e)
    return NextResponse.json({ error: 'Failed to fetch page' }, { status: 500 })
  }
}

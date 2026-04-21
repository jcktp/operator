/**
 * Username search engine — TypeScript reimplementation of Sherlock's core logic.
 * Checks a username across 500+ social networks using the Sherlock project's
 * community-maintained site database.
 *
 * Site data is fetched from GitHub with a 1-hour in-memory cache and a static
 * fallback for offline use.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface SiteEntry {
  url: unknown
  urlMain: unknown
  urlProbe?: unknown
  errorType: unknown
  errorMsg?: unknown
  errorCode?: unknown
  errorUrl?: unknown
  regexCheck?: unknown
  headers?: Record<string, string>
  request_method?: unknown
  request_payload?: Record<string, unknown>
  isNSFW?: boolean
  username_claimed?: string
  [key: string]: unknown
}

export type SiteDatabase = Record<string, SiteEntry>

export type ResultStatus = 'found' | 'not_found' | 'error' | 'invalid' | 'waf'

export interface SiteResult {
  site: string
  url: string
  urlMain: string
  status: ResultStatus
  httpStatus?: number
  elapsed?: number
  pageTitle?: string
  domain?: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const DATA_URL =
  'https://raw.githubusercontent.com/sherlock-project/sherlock/master/sherlock_project/resources/data.json'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0'

const REQUEST_TIMEOUT_MS = 15_000
const CONCURRENCY = 20
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

// WAF fingerprints — if found in the response, the site is blocking us
const WAF_SIGNATURES = [
  '<title>Attention Required! | Cloudflare</title>',
  'cf-error-details',
  '<title>Access denied</title>',
  'PerimeterX',
]

// ── Site data cache ──────────────────────────────────────────────────────────

let cachedData: SiteDatabase | null = null
let cachedAt = 0

// Minimal static fallback — top sites that reliably work
const FALLBACK_SITES: SiteDatabase = {
  GitHub: {
    errorType: 'status_code',
    url: 'https://www.github.com/{}',
    urlMain: 'https://www.github.com',
    username_claimed: 'torvalds',
  },
  Reddit: {
    errorType: 'status_code',
    errorCode: 404,
    url: 'https://www.reddit.com/user/{}',
    urlMain: 'https://www.reddit.com',
    username_claimed: 'spez',
  },
  Twitter: {
    errorType: 'status_code',
    url: 'https://x.com/{}',
    urlMain: 'https://x.com',
    username_claimed: 'elonmusk',
  },
  Instagram: {
    errorType: 'status_code',
    url: 'https://www.instagram.com/{}/',
    urlMain: 'https://www.instagram.com',
    username_claimed: 'instagram',
  },
  YouTube: {
    errorType: 'status_code',
    url: 'https://www.youtube.com/@{}',
    urlMain: 'https://www.youtube.com',
    username_claimed: 'youtube',
  },
  LinkedIn: {
    errorType: 'status_code',
    url: 'https://www.linkedin.com/in/{}',
    urlMain: 'https://www.linkedin.com',
    username_claimed: 'williamhgates',
  },
  Pinterest: {
    errorType: 'status_code',
    url: 'https://www.pinterest.com/{}/pins/',
    urlMain: 'https://www.pinterest.com',
    username_claimed: 'pinterest',
  },
  GitLab: {
    errorType: 'status_code',
    url: 'https://gitlab.com/{}',
    urlMain: 'https://gitlab.com',
    username_claimed: 'gitlab-org',
  },
  'Hacker News': {
    errorType: 'status_code',
    url: 'https://news.ycombinator.com/user?id={}',
    urlMain: 'https://news.ycombinator.com',
    username_claimed: 'dang',
  },
  Medium: {
    errorType: 'status_code',
    url: 'https://medium.com/@{}',
    urlMain: 'https://medium.com',
    username_claimed: 'ev',
  },
}

/** Load the Sherlock site database from GitHub (cached) or fall back to static. */
export async function loadSiteDatabase(): Promise<SiteDatabase> {
  if (cachedData && Date.now() - cachedAt < CACHE_TTL) return cachedData

  try {
    const res = await fetch(DATA_URL, {
      headers: { 'User-Agent': 'Operator/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return FALLBACK_SITES

    const raw = (await res.json()) as SiteDatabase & { $schema?: string }
    delete raw.$schema

    // Sanity check
    if (Object.keys(raw).length < 10) return FALLBACK_SITES

    cachedData = raw
    cachedAt = Date.now()
    return raw
  } catch {
    return cachedData ?? FALLBACK_SITES
  }
}

// ── Core check logic ─────────────────────────────────────────────────────────

function interpolate(template: unknown, username: string): string {
  if (typeof template !== 'string') return ''
  return template.replace(/\{\}/g, username.replace(/ /g, '%20'))
}

function detectWaf(body: string): boolean {
  return WAF_SIGNATURES.some((sig) => body.includes(sig))
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (!m) return undefined
  const raw = m[1].trim().replace(/\s+/g, ' ')
  // Skip generic/useless titles
  if (raw.length < 2 || raw.length > 200) return undefined
  if (/^(404|not found|error|page not found|access denied)/i.test(raw)) return undefined
  return raw
}

function domainFrom(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return undefined }
}

async function checkSite(
  name: string,
  entry: SiteEntry,
  username: string,
): Promise<SiteResult> {
  // Guard against malformed entries in the upstream data
  if (typeof entry.url !== 'string' || typeof entry.urlMain !== 'string') {
    return { site: name, url: '', urlMain: '', status: 'error' }
  }

  const profileUrl = interpolate(entry.url, username)
  const probeUrl = entry.urlProbe && typeof entry.urlProbe === 'string'
    ? interpolate(entry.urlProbe, username)
    : profileUrl

  // Regex validation
  if (typeof entry.regexCheck === 'string' && entry.regexCheck) {
    try {
      if (!new RegExp(entry.regexCheck).test(username)) {
        return { site: name, url: profileUrl, urlMain: entry.urlMain, status: 'invalid' }
      }
    } catch {
      // bad regex in data — skip validation
    }
  }

  const rawMethod = typeof entry.request_method === 'string' ? entry.request_method : null
  const method = (rawMethod ?? (entry.errorType === 'status_code' ? 'HEAD' : 'GET')).toUpperCase()
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT, ...(entry.headers ?? {}) }

  const fetchOpts: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: entry.errorType === 'response_url' ? 'manual' : 'follow',
  }

  // POST/PUT with payload
  if ((method === 'POST' || method === 'PUT') && entry.request_payload) {
    const payload: Record<string, string> = {}
    for (const [k, v] of Object.entries(entry.request_payload)) {
      payload[k] = interpolate(v, username)
    }
    fetchOpts.body = JSON.stringify(payload)
    headers['Content-Type'] = 'application/json'
  }

  const domain = domainFrom(entry.urlMain)
  const start = performance.now()

  try {
    const res = await fetch(probeUrl, fetchOpts)
    const elapsed = Math.round(performance.now() - start)

    // Determine status based on error type
    let status: ResultStatus
    let body: string | undefined

    if (entry.errorType === 'status_code') {
      const errorCodes = Array.isArray(entry.errorCode)
        ? entry.errorCode.filter((c): c is number => typeof c === 'number')
        : typeof entry.errorCode === 'number'
          ? [entry.errorCode]
          : [404]

      status = errorCodes.includes(res.status) ? 'not_found' : 'found'

      // HEAD may give 405 — retry with GET to be sure
      if (method === 'HEAD' && res.status === 405) {
        const retryRes = await fetch(probeUrl, {
          ...fetchOpts,
          method: 'GET',
        })
        status = errorCodes.includes(retryRes.status) ? 'not_found' : 'found'
        if (status === 'found') body = await retryRes.text()
      }

      // For found status_code results where we used HEAD, do a quick GET for the title
      if (status === 'found' && method === 'HEAD' && !body) {
        try {
          const pageRes = await fetch(profileUrl, {
            method: 'GET',
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(5_000),
            redirect: 'follow',
          })
          if (pageRes.ok) body = await pageRes.text()
        } catch { /* title fetch is best-effort */ }
      }
    } else if (entry.errorType === 'message') {
      body = await res.text()

      if (detectWaf(body)) {
        return { site: name, url: profileUrl, urlMain: entry.urlMain, status: 'waf', httpStatus: res.status, elapsed, domain }
      }

      const rawMsgs = Array.isArray(entry.errorMsg)
        ? entry.errorMsg.filter((m): m is string => typeof m === 'string')
        : typeof entry.errorMsg === 'string'
          ? [entry.errorMsg]
          : []

      const hasError = rawMsgs.some((msg) => body!.includes(msg))
      status = hasError ? 'not_found' : 'found'
    } else {
      // response_url — if 2xx then found (no redirect), otherwise not found
      status = res.status >= 200 && res.status < 300 ? 'found' : 'not_found'
    }

    // Extra guard: 4xx/5xx on "found" results are false positives
    if (status === 'found' && entry.errorType === 'status_code' && res.status >= 400) {
      status = 'not_found'
    }

    const pageTitle = status === 'found' && body ? extractTitle(body) : undefined

    return { site: name, url: profileUrl, urlMain: entry.urlMain, status, httpStatus: res.status, elapsed, pageTitle, domain }
  } catch {
    return {
      site: name,
      url: profileUrl,
      urlMain: entry.urlMain,
      status: 'error',
      elapsed: Math.round(performance.now() - start),
      domain,
    }
  }
}

// ── Streaming search ─────────────────────────────────────────────────────────

/**
 * Search for a username across all sites, streaming results as NDJSON.
 * Returns a ReadableStream that emits one JSON line per site result,
 * plus a final `{ done: true, total, found }` summary line.
 */
export function searchUsername(
  username: string,
  options?: { skipNsfw?: boolean },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        const sites = await loadSiteDatabase()
        const entries = Object.entries(sites).filter(
          ([, entry]) =>
            typeof entry.url === 'string' &&
            typeof entry.errorType === 'string' &&
            !(options?.skipNsfw && entry.isNSFW),
        )

        const total = entries.length
        let found = 0
        let completed = 0

        // Send initial metadata
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: 'start', total, username }) + '\n'),
        )

        // Process in batches of CONCURRENCY
        for (let i = 0; i < entries.length; i += CONCURRENCY) {
          const batch = entries.slice(i, i + CONCURRENCY)
          const results = await Promise.all(
            batch.map(([name, entry]) => checkSite(name, entry, username)),
          )

          for (const result of results) {
            completed++
            if (result.status === 'found') found++
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: 'result', ...result, progress: completed / total }) + '\n',
              ),
            )
          }
        }

        controller.enqueue(
          encoder.encode(JSON.stringify({ type: 'done', total, found }) + '\n'),
        )
      } catch (e) {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ type: 'error', message: e instanceof Error ? e.message : String(e) }) + '\n',
          ),
        )
      } finally {
        controller.close()
      }
    },
  })
}

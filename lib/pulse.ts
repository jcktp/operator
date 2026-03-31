// ── RSS / Atom / Bluesky / Mastodon / YouTube / Reddit feed fetcher ──────────

interface FeedItem {
  title: string
  url: string | null
  summary: string | null
  publishedAt: Date | null
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = xml.match(re)
  return m ? m[1].trim() : null
}

function extractLinkHref(chunk: string): string | null {
  const m = chunk.match(/<link[^>]+href=["']([^"']+)["']/)
  return m ? m[1] : null
}

function parseDate(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function clean(s: string): string {
  return stripHtml(stripCdata(s)).trim()
}

function parseItems(xml: string): FeedItem[] {
  const items: FeedItem[] = []
  const re = /<(?:item|entry)(?: [^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi
  let m: RegExpExecArray | null

  while ((m = re.exec(xml)) !== null) {
    const chunk = m[1]

    const rawTitle = extractTag(chunk, 'title') ?? ''
    const title = clean(rawTitle).slice(0, 300) || 'Untitled'

    const linkText = extractTag(chunk, 'link')
    const linkHref = extractLinkHref(chunk)
    const url = (linkText && linkText.startsWith('http') ? linkText : linkHref) ?? null

    const rawDesc =
      extractTag(chunk, 'description') ??
      extractTag(chunk, 'summary') ??
      extractTag(chunk, 'media:description') ??
      null
    const summary = rawDesc ? clean(rawDesc).slice(0, 600) : null

    const rawDate =
      extractTag(chunk, 'pubDate') ??
      extractTag(chunk, 'published') ??
      extractTag(chunk, 'updated') ??
      extractTag(chunk, 'dc:date') ??
      null
    const publishedAt = parseDate(rawDate)

    items.push({ title, url, summary, publishedAt })
  }

  return items.slice(0, 50)
}

// ── Bluesky (AT Protocol) ───────────────────────────────────────────────────

function normaliseBlueskyHandle(input: string): string {
  // Accept @handle.bsky.social, handle.bsky.social, bsky.app/profile/handle
  const profileMatch = input.match(/bsky\.app\/profile\/([^/?]+)/)
  if (profileMatch) return profileMatch[1]
  return input.replace(/^@/, '').trim()
}

type BskyPost = {
  post: {
    uri: string
    record: { text?: string; createdAt?: string }
    embed?: { images?: Array<{ alt?: string }> }
  }
}

async function fetchBlueskyItems(url: string): Promise<FeedItem[]> {
  const isTimeline = url.trim().toLowerCase() === 'timeline'

  if (isTimeline) {
    // Authenticated home timeline
    const identifier = (process.env.BLUESKY_IDENTIFIER ?? '').replace(/^@/, '').replace(/\.bsky\.app$/, '.bsky.social').trim()
    const appPassword = (process.env.BLUESKY_APP_PASSWORD ?? '').trim()
    if (!identifier || !appPassword) {
      throw new Error('Bluesky credentials not configured — add handle and app password in Settings → AI → Social')
    }

    // Create session
    const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password: appPassword }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!sessionRes.ok) {
      const errBody = await sessionRes.json().catch(() => ({})) as { error?: string; message?: string }
      throw new Error(`Bluesky login failed (${sessionRes.status}): ${errBody.error ?? errBody.message ?? 'unknown error'} [handle: "${identifier}"]`)
    }
    const session = await sessionRes.json() as { accessJwt: string; handle: string }

    // Fetch home timeline
    const feedRes = await fetch(
      'https://bsky.social/xrpc/app.bsky.feed.getTimeline?limit=30',
      { headers: { Authorization: `Bearer ${session.accessJwt}` }, signal: AbortSignal.timeout(10_000) }
    )
    if (!feedRes.ok) throw new Error(`Bluesky timeline fetch failed (HTTP ${feedRes.status})`)
    const feedData = await feedRes.json() as { feed?: BskyPost[] }

    return (feedData.feed ?? []).map(({ post }) => ({
      title: (post.record.text ?? '').slice(0, 120) + ((post.record.text?.length ?? 0) > 120 ? '…' : ''),
      url: `https://bsky.app/profile/${post.uri.split('/')[2]}/post/${post.uri.split('/').pop()}`,
      summary: post.record.text ?? null,
      publishedAt: parseDate(post.record.createdAt ?? null),
    }))
  }

  // Public profile feed (no auth needed)
  const handle = normaliseBlueskyHandle(url)
  const feedRes = await fetch(
    `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=30&filter=posts_no_replies`,
    { signal: AbortSignal.timeout(10_000) }
  )
  if (!feedRes.ok) throw new Error(`Bluesky profile fetch failed (HTTP ${feedRes.status})`)
  const feedData = await feedRes.json() as { feed?: BskyPost[] }

  return (feedData.feed ?? []).map(({ post }) => ({
    title: (post.record.text ?? '').slice(0, 120) + ((post.record.text?.length ?? 0) > 120 ? '…' : ''),
    url: `https://bsky.app/profile/${post.uri.split('/')[2]}/post/${post.uri.split('/').pop()}`,
    summary: post.record.text ?? null,
    publishedAt: parseDate(post.record.createdAt ?? null),
  }))
}

// ── Mastodon ────────────────────────────────────────────────────────────────

function parseMastodonHandle(input: string): { instance: string; acct: string | null } {
  // @user@instance.social or instance.social/@user or just instance.social
  const fullHandle = input.match(/^@?([^@]+)@([^/]+)$/)
  if (fullHandle) return { instance: fullHandle[2], acct: fullHandle[1] }
  const profileUrl = input.match(/([^/]+\.[^/]+)\/@([^/]+)/)
  if (profileUrl) return { instance: profileUrl[1], acct: profileUrl[2] }
  // Just an instance domain — home timeline
  const domain = input.replace(/^https?:\/\//, '').split('/')[0]
  return { instance: domain, acct: null }
}

type MastodonStatus = {
  id: string
  content: string
  url: string
  created_at: string
  account: { display_name: string; acct: string }
}

async function fetchMastodonItems(url: string): Promise<FeedItem[]> {
  const { instance, acct } = parseMastodonHandle(url)
  if (!instance) throw new Error('Could not parse Mastodon instance from URL')

  const base = `https://${instance}`
  const token = process.env.MASTODON_ACCESS_TOKEN ?? ''

  let statuses: MastodonStatus[]

  if (acct) {
    // Public profile — no auth needed
    const lookupRes = await fetch(`${base}/api/v1/accounts/lookup?acct=${encodeURIComponent(acct)}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!lookupRes.ok) throw new Error(`Mastodon account lookup failed (HTTP ${lookupRes.status})`)
    const account = await lookupRes.json() as { id: string }
    const statusRes = await fetch(`${base}/api/v1/accounts/${account.id}/statuses?limit=30&exclude_replies=true`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!statusRes.ok) throw new Error(`Mastodon statuses fetch failed (HTTP ${statusRes.status})`)
    statuses = await statusRes.json() as MastodonStatus[]
  } else {
    // Home timeline — requires access token
    if (!token) {
      throw new Error(`Mastodon access token not configured — add it in Settings → AI → Social, then use your instance domain as the feed URL`)
    }
    const timelineRes = await fetch(`${base}/api/v1/timelines/home?limit=30`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!timelineRes.ok) throw new Error(`Mastodon home timeline failed (HTTP ${timelineRes.status}) — check your access token`)
    statuses = await timelineRes.json() as MastodonStatus[]
  }

  return statuses.map(s => ({
    title: (clean(s.content).slice(0, 120) + (clean(s.content).length > 120 ? '…' : '')) || 'Post',
    url: s.url,
    summary: clean(s.content).slice(0, 500) || null,
    publishedAt: parseDate(s.created_at),
  }))
}

// ── URL normalisers ──────────────────────────────────────────────────────────

function normaliseRedditUrl(input: string): string {
  const m = input.match(/(?:reddit\.com\/)?r\/([A-Za-z0-9_]+)/)
  if (m) return `https://www.reddit.com/r/${m[1]}/.rss`
  if (input.startsWith('http')) return input
  return `https://www.reddit.com/r/${input}/.rss`
}

function normaliseYouTubeUrl(input: string): string {
  if (input.includes('youtube.com/feeds')) return input
  const channelMatch = input.match(/channel\/([A-Za-z0-9_-]+)/)
  if (channelMatch) return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelMatch[1]}`
  const idMatch = input.match(/[?&]channel_id=([A-Za-z0-9_-]+)/)
  if (idMatch) return `https://www.youtube.com/feeds/videos.xml?channel_id=${idMatch[1]}`
  if (/^UC[A-Za-z0-9_-]{22}$/.test(input.trim())) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${input.trim()}`
  }
  return input
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function fetchFeedItems(url: string, type: string): Promise<FeedItem[]> {
  if (type === 'bluesky')  return fetchBlueskyItems(url)
  if (type === 'mastodon') return fetchMastodonItems(url)

  let fetchUrl = url
  if (type === 'reddit')  fetchUrl = normaliseRedditUrl(url)
  if (type === 'youtube') fetchUrl = normaliseYouTubeUrl(url)

  let res: Response
  try {
    res = await fetch(fetchUrl, {
      headers: { 'User-Agent': 'Operator/1.0 (feed reader)' },
      signal: AbortSignal.timeout(10_000),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Provide friendlier messages for common network failures
    if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      throw new Error(`Could not resolve host — check the URL is correct`)
    }
    if (msg.includes('ECONNREFUSED')) {
      throw new Error(`Connection refused by host`)
    }
    if (msg.includes('timeout') || msg.includes('AbortError') || msg.includes('TimeoutError')) {
      throw new Error(`Feed timed out — the server took too long to respond`)
    }
    throw new Error(`Network error: ${msg}`)
  }

  if (!res.ok) throw new Error(`HTTP ${res.status} from ${fetchUrl}`)

  if (type === 'webhook') {
    const data = await res.json() as FeedItem[]
    return Array.isArray(data) ? data.slice(0, 50) : []
  }

  const xml = await res.text()
  return parseItems(xml)
}

// ── RSS / Atom / YouTube / Reddit feed fetcher ───────────────────────────────

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
  // <link href="..." /> or <link href="...">
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
  const re = /<(?:item|entry)(?: [^>]*)?>( [\s\S]*?)<\/(?:item|entry)>/gi
  let m: RegExpExecArray | null

  while ((m = re.exec(xml)) !== null) {
    const chunk = m[1]

    const rawTitle = extractTag(chunk, 'title') ?? ''
    const title = clean(rawTitle).slice(0, 300) || 'Untitled'

    // RSS uses <link>URL</link>, Atom uses <link href="URL"/>
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

function normaliseThreadsUrl(input: string): string {
  // Accept @handle, threads.net/@handle, or full URL
  const handleMatch = input.match(/(?:threads\.net\/)?@([A-Za-z0-9._]+)/)
  if (handleMatch) return `https://www.threads.net/@${handleMatch[1]}/rss`
  if (input.startsWith('@')) return `https://www.threads.net/${input}/rss`
  if (input.startsWith('http')) return input.endsWith('/rss') ? input : `${input.replace(/\/$/, '')}/rss`
  return `https://www.threads.net/@${input}/rss`
}

function normaliseRedditUrl(input: string): string {
  // Accept r/subreddit, reddit.com/r/subreddit, full URL
  const m = input.match(/(?:reddit\.com\/)?r\/([A-Za-z0-9_]+)/)
  if (m) return `https://www.reddit.com/r/${m[1]}/.rss`
  if (input.startsWith('http')) return input
  return `https://www.reddit.com/r/${input}/.rss`
}

function normaliseYouTubeUrl(input: string): string {
  // Accept channel ID, @handle, or full feed URL
  if (input.includes('youtube.com/feeds')) return input
  const channelMatch = input.match(/channel\/([A-Za-z0-9_-]+)/)
  if (channelMatch) return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelMatch[1]}`
  const idMatch = input.match(/[?&]channel_id=([A-Za-z0-9_-]+)/)
  if (idMatch) return `https://www.youtube.com/feeds/videos.xml?channel_id=${idMatch[1]}`
  // Treat as raw channel ID
  if (/^UC[A-Za-z0-9_-]{22}$/.test(input.trim())) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${input.trim()}`
  }
  return input
}

async function fetchTwitterItems(handle: string, bearerToken: string): Promise<FeedItem[]> {
  const username = handle
    .replace(/^@/, '')
    .replace(/.*(?:twitter|x)\.com\//, '')
    .split('/')[0]
    .split('?')[0]

  // Resolve username → user ID
  const userRes = await fetch(
    `https://api.twitter.com/2/users/by/username/${username}`,
    { headers: { Authorization: `Bearer ${bearerToken}` }, signal: AbortSignal.timeout(10_000) }
  )
  if (!userRes.ok) throw new Error(`X/Twitter user lookup failed (HTTP ${userRes.status}) — check bearer token`)
  const userData = await userRes.json() as { data?: { id: string }; errors?: Array<{ detail: string }> }
  const userId = userData.data?.id
  if (!userId) throw new Error(userData.errors?.[0]?.detail ?? 'X/Twitter user not found')

  // Fetch recent tweets (exclude retweets + replies for a cleaner feed)
  const tweetsRes = await fetch(
    `https://api.twitter.com/2/users/${userId}/tweets?tweet.fields=created_at,text&max_results=20&exclude=retweets,replies`,
    { headers: { Authorization: `Bearer ${bearerToken}` }, signal: AbortSignal.timeout(10_000) }
  )
  if (!tweetsRes.ok) throw new Error(`X/Twitter timeline fetch failed (HTTP ${tweetsRes.status})`)
  const tweetsData = await tweetsRes.json() as { data?: Array<{ id: string; text: string; created_at?: string }> }

  return (tweetsData.data ?? []).map(t => ({
    title: t.text.slice(0, 120) + (t.text.length > 120 ? '…' : ''),
    url: `https://x.com/${username}/status/${t.id}`,
    summary: t.text,
    publishedAt: t.created_at ? new Date(t.created_at) : null,
  }))
}

export async function fetchFeedItems(url: string, type: string): Promise<FeedItem[]> {
  // Twitter/X — uses API v2, not RSS
  if (type === 'twitter') {
    const bearerToken = process.env.TWITTER_BEARER_TOKEN ?? ''
    if (!bearerToken) throw new Error('X/Twitter Bearer Token not configured — add it in Settings → AI → Social APIs')
    return fetchTwitterItems(url, bearerToken)
  }

  let fetchUrl = url
  if (type === 'reddit') fetchUrl = normaliseRedditUrl(url)
  if (type === 'youtube') fetchUrl = normaliseYouTubeUrl(url)
  if (type === 'threads') fetchUrl = normaliseThreadsUrl(url)

  const res = await fetch(fetchUrl, {
    headers: { 'User-Agent': 'Operator/1.0 (feed reader)' },
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status} from ${fetchUrl}`)

  if (type === 'webhook') {
    // Webhook: expect JSON array of { title, url, summary, publishedAt }
    const data = await res.json() as FeedItem[]
    return Array.isArray(data) ? data.slice(0, 50) : []
  }

  const xml = await res.text()
  return parseItems(xml)
}

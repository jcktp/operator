// Types

export type PageResult =
  | { type: 'article'; title: string; favicon: string | null; html: string; text: string; url: string }
  | { type: 'youtube'; videoId: string; url: string }
  | { type: 'spotify'; embedUrl: string; url: string }
  | { type: 'error'; error: string; fallbackUrl: string }

export type ViewMode = 'reader' | 'live'

export interface Tab {
  id: string
  urlInput: string
  currentUrl: string
  viewMode: ViewMode
  loading: boolean
  page: PageResult | null
  history: string[]
  historyIndex: number
}

export interface BrowserBookmark {
  id: string
  url: string
  title: string
  favicon: string | null
  createdAt: string
}

// Tab factory

export function makeTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: crypto.randomUUID(),
    urlInput: '',
    currentUrl: '',
    viewMode: 'live',
    loading: false,
    page: null,
    history: [],
    historyIndex: -1,
    ...overrides,
  }
}

// URL helpers

export function normalizeUrl(input: string): string {
  const s = input.trim()
  if (!s) return s
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  if (s.includes(' ') || (!s.includes('.') && !s.startsWith('localhost'))) {
    return `https://www.google.com/search?q=${encodeURIComponent(s)}`
  }
  return `https://${s}`
}

// Domains known to block iframe embedding (X-Frame-Options or CSP frame-ancestors).
// We skip the iframe entirely for these and show a clear "open in tab" UI instead.
const IFRAME_BLOCKED_PATTERNS: RegExp[] = [
  /(?:^|\.)google\.[a-z.]+/,
  /(?:^|\.)bing\.com/,
  /(?:^|\.)duckduckgo\.com/,
  /(?:^|\.)yahoo\.com/,
  /(?:^|\.)facebook\.com/,
  /(?:^|\.)instagram\.com/,
  /(?:^|\.)twitter\.com/,
  /(?:^|\.)x\.com/,
  /(?:^|\.)linkedin\.com/,
  /(?:^|\.)reddit\.com/,
  /(?:^|\.)gmail\.com/,
  /(?:^|\.)netflix\.com/,
  /(?:^|\.)twitch\.tv/,
]

export function isKnownIframeBlocked(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return IFRAME_BLOCKED_PATTERNS.some(p => p.test(host))
  } catch { return false }
}

// Only specific video/track URLs get the embed player — not homepages or channels
export function isYouTubeVideo(url: string) {
  return /youtube\.com\/watch(\?|$)/.test(url)
    || /youtu\.be\/[a-zA-Z0-9_-]{11}/.test(url)
    || /youtube\.com\/shorts\/[a-zA-Z0-9_-]{11}/.test(url)
}

export function isYouTubeDomain(url: string) {
  return /(?:www\.)?youtube\.com|youtu\.be/.test(url)
}

export function isSpotifyEmbed(url: string) {
  return /open\.spotify\.com\/(track|album|playlist|episode|show)\//.test(url)
}

export function isEmbedUrl(url: string) {
  return isYouTubeVideo(url) || isSpotifyEmbed(url)
}

export function tabLabel(tab: Tab): string {
  if (!tab.currentUrl) return 'New tab'
  if (tab.page?.type === 'article' && tab.page.title) return tab.page.title
  try { return new URL(tab.currentUrl).hostname.replace(/^www\./, '') } catch { return tab.currentUrl }
}

// Session persistence

export const SESSION_KEY = 'operator_browser_tabs_v2'

export function saveTabs(tabs: Tab[], activeId: string) {
  try {
    const slim = tabs.map(t => ({
      id: t.id, urlInput: t.urlInput, currentUrl: t.currentUrl,
      viewMode: t.viewMode, history: t.history, historyIndex: t.historyIndex,
    }))
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ tabs: slim, activeId }))
  } catch {}
}

export function loadSavedTabs(): { tabs: Tab[]; activeId: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const { tabs, activeId } = JSON.parse(raw) as { tabs: Partial<Tab>[]; activeId: string }
    if (!tabs?.length) return null
    return {
      tabs: tabs.map(t => makeTab({ ...t, loading: false, page: null })),
      activeId,
    }
  } catch { return null }
}

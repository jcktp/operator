import { createHash } from 'crypto'
import { prisma } from './db'
import { chat } from './ai-providers'
import { loadAiSettings } from './settings'

/** Strip HTML tags and normalise whitespace for clean text comparison */
function htmlToText(html: string, selector?: string | null): string {
  let body = html

  // If a CSS selector is specified, try to extract that section
  // Simple support for id and class selectors
  if (selector) {
    const idMatch = selector.match(/^#([\w-]+)$/)
    const classMatch = selector.match(/^\.([\w-]+)$/)
    const tagMatch = selector.match(/^(\w+)$/)

    let pattern: RegExp | null = null
    if (idMatch) {
      pattern = new RegExp(`<[^>]+id=["']${idMatch[1]}["'][^>]*>([\\s\\S]*?)(?=<\\/[^>]+>\\s*<[^>]+id=|$)`, 'i')
    } else if (classMatch) {
      pattern = new RegExp(`<[^>]+class=["'][^"']*\\b${classMatch[1]}\\b[^"']*["'][^>]*>([\\s\\S]*?)(?=<\\/[^>]+>\\s*<[^>]+class=|$)`, 'i')
    } else if (tagMatch) {
      pattern = new RegExp(`<${tagMatch[1]}[^>]*>([\\s\\S]*?)<\\/${tagMatch[1]}>`, 'i')
    }

    if (pattern) {
      const match = body.match(pattern)
      if (match) body = match[0]
    }
  }

  // Remove script and style blocks
  body = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  body = body.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  body = body.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
  // Replace block elements with newlines
  body = body.replace(/<\/(p|div|h[1-6]|li|tr|br\s*\/?)>/gi, '\n')
  body = body.replace(/<br\s*\/?>/gi, '\n')
  // Strip remaining tags
  body = body.replace(/<[^>]+>/g, '')
  // Decode common HTML entities
  body = body
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
  // Normalise whitespace
  body = body.replace(/[ \t]+/g, ' ')
  body = body.replace(/\n{3,}/g, '\n\n')
  return body.trim()
}

/** Compute SHA-256 hash of text */
function hashContent(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

interface DiffLine {
  type: 'add' | 'remove' | 'same'
  text: string
}

/** Simple line-level diff between old and new text */
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const oldSet = new Set(oldLines)
  const newSet = new Set(newLines)

  const diff: DiffLine[] = []

  // Find removed lines (in old but not in new)
  for (const line of oldLines) {
    if (!newSet.has(line) && line.trim()) {
      diff.push({ type: 'remove', text: line })
    }
  }

  // Find added lines (in new but not in old)
  for (const line of newLines) {
    if (!oldSet.has(line) && line.trim()) {
      diff.push({ type: 'add', text: line })
    }
  }

  return diff
}

/** Fetch a URL and return the page HTML */
async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  return res.text()
}

/** Check a single monitor for changes. Returns true if a change was detected. */
export async function checkMonitor(monitorId: string): Promise<boolean> {
  const monitor = await prisma.webMonitor.findUnique({ where: { id: monitorId } })
  if (!monitor || monitor.status !== 'active') return false

  try {
    const html = await fetchPage(monitor.url)
    const text = htmlToText(html, monitor.selector)
    const hash = hashContent(text)

    const now = new Date()

    // No previous content — first check, just store baseline
    if (!monitor.lastHash) {
      await prisma.webMonitor.update({
        where: { id: monitorId },
        data: { lastContent: text, lastHash: hash, lastCheckedAt: now, errorCount: 0, lastError: null },
      })
      return false
    }

    // No change
    if (hash === monitor.lastHash) {
      await prisma.webMonitor.update({
        where: { id: monitorId },
        data: { lastCheckedAt: now, errorCount: 0, lastError: null },
      })
      return false
    }

    // Change detected — compute diff and save
    const diff = computeDiff(monitor.lastContent ?? '', text)

    // Generate AI summary of changes (best effort)
    let summary: string | null = null
    try {
      await loadAiSettings()
      const diffText = diff
        .slice(0, 30)
        .map(d => `${d.type === 'add' ? '+' : '-'} ${d.text}`)
        .join('\n')
      summary = await chat([{
        role: 'user',
        content: `A monitored web page has changed. URL: ${monitor.url}\nName: ${monitor.name}\n\nChanges:\n${diffText}\n\nWrite a 1-2 sentence summary of what changed. Be specific and concise.`,
      }], 0.2)
    } catch { /* non-blocking */ }

    await prisma.webMonitorChange.create({
      data: {
        monitorId,
        oldHash: monitor.lastHash,
        newHash: hash,
        diff: JSON.stringify(diff),
        summary,
      },
    })

    await prisma.webMonitor.update({
      where: { id: monitorId },
      data: { lastContent: text, lastHash: hash, lastCheckedAt: now, errorCount: 0, lastError: null },
    })

    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await prisma.webMonitor.update({
      where: { id: monitorId },
      data: {
        lastCheckedAt: new Date(),
        errorCount: { increment: 1 },
        lastError: msg.slice(0, 500),
      },
    })
    return false
  }
}

/** Check all active monitors that are due for a check */
export async function checkDueMonitors(): Promise<{ checked: number; changed: number }> {
  const now = new Date()
  const monitors = await prisma.webMonitor.findMany({
    where: { status: 'active' },
    select: { id: true, intervalMins: true, lastCheckedAt: true },
  })

  let checked = 0
  let changed = 0

  for (const m of monitors) {
    const dueAt = m.lastCheckedAt
      ? new Date(m.lastCheckedAt.getTime() + m.intervalMins * 60_000)
      : new Date(0)

    if (now >= dueAt) {
      checked++
      const wasChanged = await checkMonitor(m.id)
      if (wasChanged) changed++
    }
  }

  return { checked, changed }
}

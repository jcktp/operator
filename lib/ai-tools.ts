// ── Tool definitions and implementations ────────────────────────────────────
import { prisma } from './db'

export type ToolDef = {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
}

// ── Definitions ──────────────────────────────────────────────────────────────

export const TOOL_SAVE_JOURNAL: ToolDef = {
  name: 'save_to_journal',
  description: 'Save a confirmed note to the journal/notebook. ONLY call this tool when the user has explicitly asked to save a note AND has confirmed the content and title. Never call this during normal conversation or when just answering questions.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Plain text title of the note, e.g. "NexaGen Regulatory Concerns". No HTML tags.' },
      content: { type: 'string', description: 'The body of the note as an HTML string. Example: "<p>Key finding: the trial was halted.</p><ul><li>Point one</li><li>Point two</li></ul>"' },
      folder: { type: 'string', description: 'Folder to save into, e.g. "General" or "Sources". Defaults to "General".' },
    },
    required: ['title', 'content'],
  },
}

const TOOL_WEATHER: ToolDef = {
  name: 'get_weather',
  description: 'Get the current weather for any location. Always use this when asked about weather.',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City or location name, e.g. "London" or "Tokyo, Japan"' },
    },
    required: ['location'],
  },
}

const TOOL_SEARCH: ToolDef = {
  name: 'search_web',
  description: 'Search the web for current information, news, prices, or any real-time data. Use for questions that require up-to-date knowledge.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
    },
    required: ['query'],
  },
}

const TOOL_FETCH: ToolDef = {
  name: 'fetch_url',
  description: 'Fetch and read the content of a web page or URL.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to fetch' },
    },
    required: ['url'],
  },
}

const NOTE_SAVE_PATTERNS = [
  /\b(save|add|create|write|log|store|put)\b.{0,30}\b(note|journal|entry|log)\b/i,
  /\b(note|journal|entry)\b.{0,30}\b(save|add|create|write|log|store)\b/i,
  /\bsave (this|that|it)\b/i,
  /\badd (this|that|it) to (my )?(journal|notebook|notes)\b/i,
  /\bkeep (a |this )?(note|record)\b/i,
]

export function hasNoteSaveIntent(messages: Array<{ role: string; content: string }>): boolean {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUser) return false
  return NOTE_SAVE_PATTERNS.some(p => p.test(lastUser.content))
}

export function availableTools(includeJournal = true): ToolDef[] {
  const provider = (process.env.AI_PROVIDER ?? 'ollama') as string
  const tools: ToolDef[] = []

  // Journal tool: always for cloud providers; for Ollama only when the user
  // explicitly asked to save — small models invoke it unprompted otherwise,
  // which produces empty responses instead of answering the question.
  if (provider !== 'ollama' || includeJournal) tools.push(TOOL_SAVE_JOURNAL)

  // Web access tools: available for all providers when the user has enabled web access
  // search_web always included — uses Brave if key configured, DuckDuckGo as fallback
  if (process.env.OLLAMA_WEB_ACCESS === 'true') {
    tools.push(TOOL_WEATHER, TOOL_FETCH, TOOL_SEARCH)
  }

  return tools
}

// ── Module-level note-save tracker ───────────────────────────────────────────
// Safe for single-user app — reset before each chatWithTools call
let _noteSaved: { title: string; folder: string } | null = null

export function getNoteSaved() { return _noteSaved }
export function resetNoteSaved() { _noteSaved = null }

// ── Tool implementations ──────────────────────────────────────────────────────

export async function executeTool(name: string, args: Record<string, string>): Promise<string> {
  try {
    if (name === 'save_to_journal') return await toolSaveJournal(args.title, args.content, args.folder)
    if (name === 'get_weather')     return await toolWeather(args.location)
    if (name === 'search_web')      return await toolSearch(args.query)
    if (name === 'fetch_url')       return await toolFetchUrl(args.url)
    return `Unknown tool: ${name}`
  } catch (e) {
    return `Tool error: ${String(e)}`
  }
}

async function toolSaveJournal(title: string, content: string, folder?: string): Promise<string> {
  if (!title?.trim()) return 'Tool error: title is required'
  if (!content?.trim()) return 'Tool error: content is required'
  const cleanTitle = title.trim()
  const cleanFolder = folder?.trim() || 'General'
  await prisma.journalEntry.create({
    data: { title: cleanTitle, folder: cleanFolder, content, weekStart: null },
  })
  _noteSaved = { title: cleanTitle, folder: cleanFolder }
  return `Note saved: "${cleanTitle}"`
}

async function toolWeather(location: string): Promise<string> {
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`,
    { signal: AbortSignal.timeout(8000) }
  )
  const geoData = await geoRes.json() as { results?: Array<{ latitude: number; longitude: number; name: string; country: string; admin1?: string }> }
  if (!geoData.results?.length) return `Could not find location: "${location}"`
  const { latitude, longitude, name, country, admin1 } = geoData.results[0]

  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,precipitation,is_day` +
    `&timezone=auto&forecast_days=1`,
    { signal: AbortSignal.timeout(8000) }
  )
  const wd = await weatherRes.json() as { current: Record<string, number>; current_units: Record<string, string> }
  const c = wd.current
  const u = wd.current_units

  const codes: Record<number, string> = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Freezing fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Rain showers', 81: 'Showers', 82: 'Violent showers',
    85: 'Snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail',
  }
  const desc = codes[c.weather_code] ?? `Condition code ${c.weather_code}`
  const place = [name, admin1, country].filter(Boolean).join(', ')

  return [
    `**Current weather in ${place}:**`,
    `- Conditions: ${desc}`,
    `- Temperature: ${c.temperature_2m}${u.temperature_2m} (feels like ${c.apparent_temperature}${u.apparent_temperature})`,
    `- Wind: ${c.wind_speed_10m} ${u.wind_speed_10m}`,
    `- Humidity: ${c.relative_humidity_2m}${u.relative_humidity_2m}`,
    c.precipitation > 0 ? `- Precipitation: ${c.precipitation}${u.precipitation}` : null,
  ].filter(Boolean).join('\n')
}

async function toolSearch(query: string): Promise<string> {
  const key = process.env.BRAVE_SEARCH_KEY

  if (key) {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&safesearch=off`,
      {
        headers: { 'Accept': 'application/json', 'X-Subscription-Token': key },
        signal: AbortSignal.timeout(8000),
      }
    )
    const data = await res.json() as { web?: { results?: Array<{ title: string; url: string; description: string }> } }
    const results = data.web?.results ?? []
    if (!results.length) return `No search results found for: "${query}"`
    return results.map((r, i) =>
      `${i + 1}. **${r.title}**\n   ${r.description}\n   ${r.url}`
    ).join('\n\n')
  }

  // DuckDuckGo fallback — free, no key required
  const res = await fetch(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`,
    {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Operator/1.0)' },
      signal: AbortSignal.timeout(8000),
    }
  )
  const ddg = await res.json() as {
    Answer?: string
    AbstractText?: string
    AbstractSource?: string
    AbstractURL?: string
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Name?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>
  }

  const lines: string[] = []

  if (ddg.Answer) {
    lines.push(`**Answer:** ${ddg.Answer}`)
  }
  if (ddg.AbstractText) {
    const source = ddg.AbstractSource ? ` (${ddg.AbstractSource})` : ''
    lines.push(`**Summary${source}:** ${ddg.AbstractText}`)
    if (ddg.AbstractURL) lines.push(`   ${ddg.AbstractURL}`)
  }

  const topics = ddg.RelatedTopics ?? []
  let count = 0
  for (const t of topics) {
    if (count >= 4) break
    if (t.Text && t.FirstURL) {
      lines.push(`\n${count + 1}. ${t.Text}\n   ${t.FirstURL}`)
      count++
    } else if (t.Topics) {
      for (const sub of t.Topics) {
        if (count >= 4) break
        if (sub.Text && sub.FirstURL) {
          lines.push(`\n${count + 1}. ${sub.Text}\n   ${sub.FirstURL}`)
          count++
        }
      }
    }
  }

  if (!lines.length) return `No results found for: "${query}"`
  return lines.join('\n')
}

async function toolFetchUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Operator/1.0)' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return `HTTP ${res.status} — could not fetch ${url}`
  const text = await res.text()
  const clean = text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000)
  return `Content from ${url}:\n\n${clean}`
}

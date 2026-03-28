// ── Journalism-specific AI analysis functions ─────────────────────────────────
import { chat } from './ai-providers'
import { maxContentLength } from './ai-providers'

function extractJson(text: string): string {
  const t = text.trim()
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    const candidate = fenced[1].trim()
    try { JSON.parse(candidate); return candidate } catch {}
  }
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start !== -1 && end > start) {
    const candidate = t.slice(start, end + 1)
    try { JSON.parse(candidate); return candidate } catch {}
  }
  // Also try array extraction
  const aStart = t.indexOf('[')
  const aEnd = t.lastIndexOf(']')
  if (aStart !== -1 && aEnd > aStart) {
    const candidate = t.slice(aStart, aEnd + 1)
    try { JSON.parse(candidate); return candidate } catch {}
  }
  throw new Error(`No valid JSON in response (len=${t.length}, preview=${t.slice(0, 100)})`)
}

// ── Named Entity Extraction ───────────────────────────────────────────────────

export interface NamedEntity {
  type: 'person' | 'organisation' | 'location' | 'date' | 'financial'
  name: string
  context?: string
}

export async function extractEntities(
  content: string,
  title: string,
  area: string
): Promise<NamedEntity[]> {
  const truncated = content.slice(0, maxContentLength())
  const prompt = `Extract all named entities from this document. Record each entity's type and exact name as it appears.

Document: ${title} (${area})

Content:
${truncated}

Return ONLY valid JSON:
{
  "entities": [
    {"type": "person|organisation|location|date|financial", "name": "exact name from document", "context": "optional: title, role, or brief context if stated"}
  ]
}

Types:
- person: full names of individuals, including titles or roles if mentioned alongside the name
- organisation: companies, government bodies, NGOs, agencies, institutions
- location: countries, cities, addresses, named places
- date: specific dates, time periods, or date references (e.g. "Q3 2023", "15 March 2024")
- financial: monetary amounts, financial figures (e.g. "$4.2 million", "€500k")

Limits: max 30 entities. Only include entities explicitly named in the document. Do not infer.`

  try {
    const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
    const json = extractJson(text)
    const parsed = JSON.parse(json) as { entities?: unknown[] }
    if (!Array.isArray(parsed.entities)) return []
    const VALID_ENTITY_TYPES = new Set<string>(['person', 'organisation', 'location', 'date', 'financial'])
    return (parsed.entities as NamedEntity[]).filter(
      e => e && VALID_ENTITY_TYPES.has(e.type) && typeof e.name === 'string' && e.name.trim().length > 0
    )
  } catch (e) {
    console.error('extractEntities failed:', e)
    return []
  }
}

// ── Timeline Extraction ───────────────────────────────────────────────────────

export interface JournalismTimelineEvent {
  dateText: string
  dateSortKey?: string | null
  event: string
}

export async function extractTimeline(
  content: string,
  title: string
): Promise<JournalismTimelineEvent[]> {
  const truncated = content.slice(0, maxContentLength())
  const prompt = `Extract all dated events and chronological references from this document.

Document: ${title}

Content:
${truncated}

Return ONLY valid JSON:
{
  "events": [
    {
      "dateText": "date as it appears in the document, e.g. '15 March 2024' or 'Q3 2023'",
      "dateSortKey": "YYYY-MM-DD ISO date if determinable, or null if only approximate",
      "event": "brief factual description of what happened on this date, as stated in the document"
    }
  ]
}

Limits: max 20 events. Only include events with a clear date reference. Exclude vague references without any time anchor. Do not invent dates or events.`

  try {
    const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
    const json = extractJson(text)
    const parsed = JSON.parse(json) as { events?: unknown[] }
    if (!Array.isArray(parsed.events)) return []
    return (parsed.events as JournalismTimelineEvent[]).filter(
      e => e && typeof e.dateText === 'string' && typeof e.event === 'string' && e.event.trim().length > 0
    )
  } catch (e) {
    console.error('extractTimeline failed:', e)
    return []
  }
}

// ── Redaction Detection ───────────────────────────────────────────────────────

export interface RedactionEntry {
  type: 'blackout' | 'placeholder' | 'gap' | 'missing_reference'
  location: string
  context: string
}

export async function detectRedactions(
  content: string,
  title: string
): Promise<RedactionEntry[]> {
  const truncated = content.slice(0, maxContentLength())
  const prompt = `Examine this document for signs of redaction or deliberately withheld information.

Document: ${title}

Content:
${truncated}

Look for:
1. Explicit redaction markers: [REDACTED], [WITHHELD], [EXEMPTED], ████, ***, (b)(6), s.40, or similar
2. Unusual numbering discontinuities, missing page numbers, or skipped sections
3. Text that appears cut off mid-sentence or paragraph
4. References to content (exhibits, attachments, sections) that are not present in this document
5. Repetitive replacement characters or unusual spacing suggesting removed text

Return ONLY valid JSON:
{
  "redactions": [
    {
      "type": "blackout|placeholder|gap|missing_reference",
      "location": "where in the document (e.g. 'Page 3, paragraph 2' or 'Section 4.1' or 'near reference to X')",
      "context": "the surrounding text that survived, giving context for what was redacted (up to 100 words)"
    }
  ]
}

Types:
- blackout: text replaced with black bars, asterisks, or repeated characters
- placeholder: explicit [REDACTED]-style markers
- gap: unusual discontinuity in numbering, pagination, or flow
- missing_reference: document references content that is not present

Return an empty array if no genuine signs of redaction are found. Do not flag normal editorial choices or formatting.`

  try {
    const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
    const json = extractJson(text)
    const parsed = JSON.parse(json) as { redactions?: unknown[] }
    if (!Array.isArray(parsed.redactions)) return []
    return (parsed.redactions as RedactionEntry[]).filter(
      r => r && typeof r.type === 'string' && typeof r.location === 'string' && typeof r.context === 'string'
    )
  } catch (e) {
    console.error('detectRedactions failed:', e)
    return []
  }
}

// ── Document Comparison ───────────────────────────────────────────────────────

export interface JournalismPassage {
  text: string
  appearsIn: 'previous' | 'current'
}

export interface JournalismFigureChange {
  label: string
  previous: string
  current: string
}

export interface JournalismComparison {
  headline: string
  passages: JournalismPassage[]
  figures: JournalismFigureChange[]
  entitiesAdded: string[]
  entitiesRemoved: string[]
  possibleRedactions: string[]
}

export async function compareDocumentsJournalism(
  prevContent: string,
  prevTitle: string,
  currContent: string,
  currTitle: string
): Promise<JournalismComparison> {
  const maxLen = Math.floor(maxContentLength() / 2)
  const prevTrunc = prevContent.slice(0, maxLen)
  const currTrunc = currContent.slice(0, maxLen)

  const prompt = `You are a journalist comparing two versions of a document. Identify what changed between them.

PREVIOUS DOCUMENT: ${prevTitle}
${prevTrunc}

---

CURRENT DOCUMENT: ${currTitle}
${currTrunc}

Identify:
1. Specific claims or passages that appear in one document but not the other
2. Figures or numbers that changed between versions
3. Named people, organisations, or locations that were added or removed
4. Sections or content that appear to have been removed or redacted

Return ONLY valid JSON:
{
  "headline": "1 sentence summarising the most significant difference between the two documents",
  "passages": [
    {"text": "brief description of the passage or claim", "appearsIn": "previous|current"}
  ],
  "figures": [
    {"label": "what the figure refers to", "previous": "value in previous doc", "current": "value in current doc"}
  ],
  "entitiesAdded": ["names that appear in current but not previous"],
  "entitiesRemoved": ["names present in previous but absent from current"],
  "possibleRedactions": ["description of anything that appears to have been removed or redacted between versions"]
}

Limits: max 5 passages, 5 figures, 5 entitiesAdded, 5 entitiesRemoved, 3 possibleRedactions. Only flag genuine differences.`

  try {
    const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
    const json = extractJson(text)
    const parsed = JSON.parse(json) as Partial<JournalismComparison>
    return {
      headline: typeof parsed.headline === 'string' ? parsed.headline : '',
      passages: Array.isArray(parsed.passages) ? parsed.passages : [],
      figures: Array.isArray(parsed.figures) ? parsed.figures : [],
      entitiesAdded: Array.isArray(parsed.entitiesAdded) ? parsed.entitiesAdded : [],
      entitiesRemoved: Array.isArray(parsed.entitiesRemoved) ? parsed.entitiesRemoved : [],
      possibleRedactions: Array.isArray(parsed.possibleRedactions) ? parsed.possibleRedactions : [],
    }
  } catch (e) {
    console.error('compareDocumentsJournalism failed:', e)
    return { headline: '', passages: [], figures: [], entitiesAdded: [], entitiesRemoved: [], possibleRedactions: [] }
  }
}

// ── Verification Checklist ────────────────────────────────────────────────────

export interface VerificationItem {
  claim: string
  claimType: 'statistical' | 'attribution' | 'event' | 'legal'
  evidenceNeeded: string
  suggestedSources: string[]
}

export async function generateVerificationChecklist(
  content: string,
  title: string,
  area: string
): Promise<VerificationItem[]> {
  const truncated = content.slice(0, maxContentLength())

  const prompt = `You are a verification editor reviewing a document before publication. Your task is to identify key claims that require verification.

DOCUMENT TITLE: ${title}
AREA: ${area}

DOCUMENT CONTENT:
${truncated}

Identify up to 8 key claims in this document that a journalist would need to verify before publishing. For each claim:
- Classify it as one of: statistical (a number, percentage, or data point), attribution (a quote or statement attributed to someone), event (something that allegedly happened), legal (a legal status, ruling, or allegation)
- Describe specifically what evidence would be needed to verify or refute it
- List 2-4 types of sources or documents that could provide that evidence

Return ONLY valid JSON as an array:
[
  {
    "claim": "the specific claim as stated or closely paraphrased",
    "claimType": "statistical|attribution|event|legal",
    "evidenceNeeded": "specific description of what evidence would verify or refute this",
    "suggestedSources": ["source type 1", "source type 2"]
  }
]

Only include claims that genuinely need verification — skip obvious background facts. Max 8 items.`

  try {
    const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
    const json = extractJson(text)
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item: unknown) => item && typeof item === 'object')
      .map((item: Record<string, unknown>) => ({
        claim: typeof item.claim === 'string' ? item.claim : '',
        claimType: (['statistical', 'attribution', 'event', 'legal'].includes(item.claimType as string)
          ? item.claimType
          : 'event') as VerificationItem['claimType'],
        evidenceNeeded: typeof item.evidenceNeeded === 'string' ? item.evidenceNeeded : '',
        suggestedSources: Array.isArray(item.suggestedSources) ? item.suggestedSources.map(String) : [],
      }))
      .filter((item) => item.claim.length > 0)
  } catch (e) {
    console.error('generateVerificationChecklist failed:', e)
    return []
  }
}

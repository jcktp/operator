// ── Journalism-specific AI analysis functions ─────────────────────────────────
import { chat, getProvider } from './ai-providers'
import { maxContentLength } from './ai-providers'
import { extractJsonFromText } from './utils'

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
  const prompt = `Extract all named entities from this document. Record each entity's type and exact name as it appears. Always respond in English — translate names and context from any source language.

Document: ${title} (${area})

Content:
${truncated}

Return ONLY valid JSON:
{
  "entities": [
    {"type": "person|organisation|location|date|financial", "name": "exact name from document (translated to English if needed)", "context": "required for locations: 1-2 sentences describing what happened at or in connection with this place in the document. For other types: title, role, or brief context if stated."}
  ]
}

Types:
- person: full names of individuals, including titles or roles if mentioned alongside the name
- organisation: companies, government bodies, NGOs, agencies, institutions
- location: countries, cities, regions, addresses, named places. IMPORTANT: if a city or place appears inside an organisation name or address (e.g. "Ministry of Infrastructure, The Hague" or "EU Office Brussels"), extract the city/place as a separate location entity in addition to the organisation
- date: specific dates, time periods, or date references (e.g. "Q3 2023", "15 March 2024")
- financial: monetary amounts, financial figures (e.g. "$4.2 million", "€500k")

Rules:
- For location entities, the context field is REQUIRED and must describe what event, meeting, incident, or activity took place at or near this location according to the document. Do not just name the country or say "city in X".
- Extract embedded locations from organisation names, addresses, and meeting venues as standalone location entities
- Max 50 entities total
- Only include entities explicitly named in the document — do not infer`

  try {
    const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
    const json = extractJsonFromText(text)
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
  const prompt = `Extract all dated events and chronological references from this document. Always respond in English — translate content from any source language.

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
    const json = extractJsonFromText(text)
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
  const prompt = `Examine this document for signs of redaction or deliberately withheld information. Always respond in English — translate content from any source language.

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
    const json = extractJsonFromText(text)
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

  const prompt = `You are a journalist comparing two versions of a document. Identify what changed between them. Always respond in English — translate content from any source language.

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
    const json = extractJsonFromText(text)
    const parsed = JSON.parse(json) as Partial<JournalismComparison>
    const toStringArray = (v: unknown): string[] =>
      Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : []
    const toPassages = (v: unknown): JournalismPassage[] =>
      Array.isArray(v)
        ? (v as unknown[]).filter(
            (x): x is JournalismPassage =>
              x !== null && typeof x === 'object' &&
              typeof (x as Record<string, unknown>).text === 'string' &&
              typeof (x as Record<string, unknown>).appearsIn === 'string'
          )
        : []
    return {
      headline: typeof parsed.headline === 'string' ? parsed.headline : '',
      passages: toPassages(parsed.passages),
      figures: Array.isArray(parsed.figures) ? parsed.figures : [],
      entitiesAdded: toStringArray(parsed.entitiesAdded),
      entitiesRemoved: toStringArray(parsed.entitiesRemoved),
      possibleRedactions: toStringArray(parsed.possibleRedactions),
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

  const prompt = `You are a verification editor reviewing a document before publication. Your task is to identify key claims that require verification. Always respond in English — translate content from any source language.

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
    const json = extractJsonFromText(text)
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

// ── Merged extraction (single call for local models) ────────────────────────
// Combines entities + timeline + redactions + verification into one prompt so
// Ollama reads the document once instead of up to 4 times.

export interface ActionItemExtract {
  title: string
  assignee?: string
  dueDate?: string
}

export interface MergedExtractionResult {
  entities: NamedEntity[]
  events: JournalismTimelineEvent[]
  redactions: RedactionEntry[]
  verification: VerificationItem[]
  tags: string[]
  actionItems: ActionItemExtract[]
}

export async function extractMerged(
  content: string,
  title: string,
  area: string,
  features: { entities: boolean; timeline: boolean; redactions: boolean; verification: boolean; tags: boolean; actionItems: boolean },
): Promise<MergedExtractionResult> {
  // Cloud providers are fast enough to run separate calls in parallel
  if (getProvider() !== 'ollama') {
    const [entities, events, redactions, verification] = await Promise.all([
      features.entities ? extractEntities(content, title, area) : Promise.resolve([]),
      features.timeline ? extractTimeline(content, title) : Promise.resolve([]),
      features.redactions ? detectRedactions(content, title) : Promise.resolve([]),
      features.verification ? generateVerificationChecklist(content, title, area) : Promise.resolve([]),
    ])
    // Tags and action items are lightweight — extract in one combined call
    let tags: string[] = []
    let actionItems: ActionItemExtract[] = []
    if (features.tags || features.actionItems) {
      try {
        const truncated = content.slice(0, maxContentLength())
        const prompt = `Analyse this document and extract the requested information. Always respond in English.

Document: ${title} (${area})

Content:
${truncated}

Return ONLY valid JSON:
{
  ${features.tags ? '"tags": ["3-8 short lowercase topic tags categorizing this document"],' : ''}
  ${features.actionItems ? '"actionItems": [{"title": "action/task/follow-up", "assignee": "person if stated or null", "dueDate": "date if stated or null"}]' : ''}
}`
        const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
        const json = extractJsonFromText(text)
        const parsed = JSON.parse(json) as Record<string, unknown>
        if (features.tags && Array.isArray(parsed.tags)) {
          tags = (parsed.tags as string[]).filter(t => typeof t === 'string' && t.trim().length > 0).map(t => t.toLowerCase().trim())
        }
        if (features.actionItems && Array.isArray(parsed.actionItems)) {
          actionItems = (parsed.actionItems as ActionItemExtract[]).filter(a => a && typeof a.title === 'string' && a.title.trim().length > 0)
        }
      } catch (e) { console.error('Tags/action items extraction failed:', e) }
    }
    return { entities, events, redactions, verification, tags, actionItems }
  }

  // Build a single combined prompt for Ollama
  const truncated = content.slice(0, maxContentLength())
  const sections: string[] = []
  const schema: string[] = []

  if (features.entities) {
    sections.push(`ENTITIES: Extract all named entities (person, organisation, location, date, financial). For locations, include context describing what happened there. Max 30.`)
    schema.push(`"entities": [{"type": "person|organisation|location|date|financial", "name": "exact name", "context": "brief context or role"}]`)
  }
  if (features.timeline) {
    sections.push(`TIMELINE: Extract all dated events with date references. Max 15.`)
    schema.push(`"events": [{"dateText": "date as written", "dateSortKey": "YYYY-MM-DD or null", "event": "what happened"}]`)
  }
  if (features.redactions) {
    sections.push(`REDACTIONS: Look for [REDACTED] markers, blackout bars, numbering gaps, missing references, cut-off text. Empty array if none found.`)
    schema.push(`"redactions": [{"type": "blackout|placeholder|gap|missing_reference", "location": "where in document", "context": "surrounding text"}]`)
  }
  if (features.verification) {
    sections.push(`VERIFICATION: Identify up to 6 key claims that need fact-checking before publication. Classify each as statistical, attribution, event, or legal.`)
    schema.push(`"verification": [{"claim": "the claim", "claimType": "statistical|attribution|event|legal", "evidenceNeeded": "what to check", "suggestedSources": ["source type"]}]`)
  }
  if (features.tags) {
    sections.push(`TAGS: Extract 3-8 short lowercase topic tags that categorize this document's subject matter.`)
    schema.push(`"tags": ["tag1", "tag2", "tag3"]`)
  }
  if (features.actionItems) {
    sections.push(`ACTION ITEMS: Extract action items, tasks, commitments, or follow-ups mentioned. Include assignee if stated and due date if mentioned. Max 10.`)
    schema.push(`"actionItems": [{"title": "the action or task", "assignee": "person name or null", "dueDate": "date or null"}]`)
  }

  if (sections.length === 0) return { entities: [], events: [], redactions: [], verification: [], tags: [], actionItems: [] }

  const prompt = `Analyse this document and extract the requested information. Always respond in English — translate from any source language.

Document: ${title} (${area})

Content:
${truncated}

TASKS:
${sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Return ONLY valid JSON:
{
  ${schema.join(',\n  ')}
}`

  try {
    const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
    const json = extractJsonFromText(text)
    const parsed = JSON.parse(json) as Record<string, unknown>

    const VALID_ENTITY_TYPES = new Set(['person', 'organisation', 'location', 'date', 'financial'])
    const entities = features.entities && Array.isArray(parsed.entities)
      ? (parsed.entities as NamedEntity[]).filter(e => e && VALID_ENTITY_TYPES.has(e.type) && typeof e.name === 'string' && e.name.trim().length > 0)
      : []
    const events = features.timeline && Array.isArray(parsed.events)
      ? (parsed.events as JournalismTimelineEvent[]).filter(e => e && typeof e.dateText === 'string' && typeof e.event === 'string' && e.event.trim().length > 0)
      : []
    const redactions = features.redactions && Array.isArray(parsed.redactions)
      ? (parsed.redactions as RedactionEntry[]).filter(r => r && typeof r.type === 'string' && typeof r.location === 'string')
      : []
    const verification = features.verification && Array.isArray(parsed.verification)
      ? (parsed.verification as VerificationItem[]).filter(v => v && typeof v.claim === 'string' && v.claim.length > 0)
          .map(v => ({
            ...v,
            claimType: (['statistical', 'attribution', 'event', 'legal'].includes(v.claimType) ? v.claimType : 'event') as VerificationItem['claimType'],
            suggestedSources: Array.isArray(v.suggestedSources) ? v.suggestedSources.map(String) : [],
          }))
      : []

    const tags = features.tags && Array.isArray(parsed.tags)
      ? (parsed.tags as string[]).filter(t => typeof t === 'string' && t.trim().length > 0).map(t => t.toLowerCase().trim())
      : []
    const actionItems = features.actionItems && Array.isArray(parsed.actionItems)
      ? (parsed.actionItems as ActionItemExtract[]).filter(a => a && typeof a.title === 'string' && a.title.trim().length > 0)
      : []

    return { entities, events, redactions, verification, tags, actionItems }
  } catch (e) {
    console.error('extractMerged failed:', e)
    return { entities: [], events: [], redactions: [], verification: [], tags: [], actionItems: [] }
  }
}

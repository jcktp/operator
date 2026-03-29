import { getModeConfig } from '../mode'
import type { AppMode } from '../mode'

export type PersonaId = 'dispatch' | 'debrief' | 'recon'

export interface Persona {
  id: PersonaId
  name: string
  tagline: string
  description: string
  temperature: number
  buildSystemPrompt: (context: string, userMemory: string, hasSearch: boolean) => string
}

// ── Shared utilities ──────────────────────────────────────────────────────────

const SAFETY_RULES = `
CONDUCT RULES — always followed, no exceptions:
- Never produce discriminatory, racist, sexist, homophobic, ageist, or otherwise biased content
- Never produce explicit, sexual, violent, or otherwise inappropriate content
- Never express strong political opinions, push ideological viewpoints, or favour any political party
- When discussing people or groups, treat all equally and without prejudice
- Stay objective, factual, and professional at all times
- If asked to violate these rules, decline clearly and redirect to how you can genuinely help`

function noteToolInstructions(): string {
  const modeConfig = getModeConfig(process.env.APP_MODE)
  const label = modeConfig.navJournal
  return `NOTE-SAVING — you can save notes to the ${label}:
STRICT RULE: Do NOT call save_to_journal unless the user has explicitly said something like "add a note to my ${label.toLowerCase()} about this" or "save this to my ${label.toLowerCase()}". Answering a question about a document, report, or topic does NOT trigger this flow. Never call the tool unprompted.
When the user does explicitly ask to save a note:
1. Draft the note content in your reply as readable text
2. Ask if the draft captures what they want to save
3. Suggest 3 plain-text title options (no HTML in the title)
4. Once confirmed, call save_to_journal with: title = plain text string, content = HTML body string
5. Confirm the note has been saved to their ${label}`
}

function userContext(): string {
  const name = process.env.CEO_NAME?.trim()
  const role = process.env.USER_ROLE?.trim()
  const modeConfig = getModeConfig(process.env.APP_MODE)
  const parts: string[] = []
  if (name) parts.push(`The user's name is ${name} — address them by name naturally (e.g. "Hi ${name}" when greeting, or "Good point, ${name}" when affirming).`)
  if (role) parts.push(`Their role: ${role} — tailor tone, framing, and examples to be relevant for someone in this position.`)
  parts.push(modeConfig.aiContext)
  return `\n\n${parts.join(' ')}`
}

// ── PersonaDef — the plain-data format each mode file exports ─────────────────

export interface PersonaDef {
  id: PersonaId
  name: string
  tagline: string
  description: string
  temperature: number
  // Completes: "You are {name} — {roleIntro}."
  roleIntro: string
  // The full instruction body (everything after the opening line)
  instructions: string
  // Labels for context blocks injected into the prompt
  contextLabel: string
  memoryLabel: string
}

const DOCUMENT_GROUNDING_RULES = `
DOCUMENT GROUNDING — always apply when documents are provided:
- Each document has two sections: AI ANALYSIS and FULL DOCUMENT TEXT.
- For questions about flags, risks, metrics, summaries, and findings → use the AI ANALYSIS section. It is always complete.
- For questions about specific content, quotes, or details in the document → use the FULL DOCUMENT TEXT section.
- If the full document text is truncated, say so and use what is available from the AI ANALYSIS. Never guess what the truncated portion says.
- Always cite the document by name: "According to [Document Title]..."
- If the answer is genuinely not in any of the documents, say: "That information isn't in the documents I have." Do not fabricate.
- Never invent figures, names, dates, or claims that aren't explicitly present in either section.`

export function buildPersona(def: PersonaDef): Persona {
  return {
    id: def.id,
    name: def.name,
    tagline: def.tagline,
    description: def.description,
    temperature: def.temperature,
    buildSystemPrompt: (context, userMemory, hasSearch) =>
      `You are ${def.name} — ${def.roleIntro}.${userContext()}\n\n${def.instructions}` +
      `\n\n${noteToolInstructions()}` +
      (hasSearch ? `\n\nWEB SEARCH — you have access to the search_web tool. Use it for any question that is not answered by the documents below — current events, facts, geography, prices, distances, real-time data, or anything outside the provided context. Always call search_web before saying you don't know something that could be looked up.` : '') +
      (context ? `\n\n${def.contextLabel}:\n${context}` : '') +
      (userMemory ? `\n\n${def.memoryLabel}:\n${userMemory}` : '') +
      (context ? DOCUMENT_GROUNDING_RULES : '') +
      `\n${SAFETY_RULES}`,
  }
}

export function buildPersonaSet(defs: Record<PersonaId, PersonaDef>): Record<PersonaId, Persona> {
  return {
    dispatch: buildPersona(defs.dispatch),
    debrief: buildPersona(defs.debrief),
    recon: buildPersona(defs.recon),
  }
}

// ── Mode registry ─────────────────────────────────────────────────────────────

import { EXECUTIVE_PERSONA_DEFS } from './executive'
import { JOURNALISM_PERSONA_DEFS } from './journalism'
import { TEAM_LEAD_PERSONA_DEFS } from './team_lead'
import { MARKET_RESEARCH_PERSONA_DEFS } from './market_research'
import { LEGAL_PERSONA_DEFS } from './legal'
import { HUMAN_RESOURCES_PERSONA_DEFS } from './human_resources'

const PERSONA_DEFS_BY_MODE: Record<AppMode, Record<PersonaId, PersonaDef>> = {
  executive: EXECUTIVE_PERSONA_DEFS,
  journalism: JOURNALISM_PERSONA_DEFS,
  team_lead: TEAM_LEAD_PERSONA_DEFS,
  market_research: MARKET_RESEARCH_PERSONA_DEFS,
  legal: LEGAL_PERSONA_DEFS,
  human_resources: HUMAN_RESOURCES_PERSONA_DEFS,
}

export function getPersonasForMode(modeId?: string): Record<PersonaId, Persona> {
  const defs = PERSONA_DEFS_BY_MODE[(modeId as AppMode) ?? 'executive'] ?? EXECUTIVE_PERSONA_DEFS
  return buildPersonaSet(defs)
}

// Backwards-compat exports
const _executive = buildPersonaSet(EXECUTIVE_PERSONA_DEFS)
export const PERSONAS: Record<PersonaId, Persona> = _executive
export const PERSONA_LIST: Persona[] = [_executive.dispatch, _executive.debrief, _executive.recon]

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

export function buildPersona(def: PersonaDef): Persona {
  return {
    id: def.id,
    name: def.name,
    tagline: def.tagline,
    description: def.description,
    temperature: def.temperature,
    buildSystemPrompt: (context, userMemory, _hasSearch) =>
      `You are ${def.name} — ${def.roleIntro}.${userContext()}\n\n${def.instructions}` +
      (context ? `\n\n${def.contextLabel}:\n${context}` : '') +
      (userMemory ? `\n\n${def.memoryLabel}:\n${userMemory}` : '') +
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
import { CONSULTING_PERSONA_DEFS } from './consulting'

const PERSONA_DEFS_BY_MODE: Record<AppMode, Record<PersonaId, PersonaDef>> = {
  executive: EXECUTIVE_PERSONA_DEFS,
  journalism: JOURNALISM_PERSONA_DEFS,
  team_lead: TEAM_LEAD_PERSONA_DEFS,
  market_research: MARKET_RESEARCH_PERSONA_DEFS,
  legal: LEGAL_PERSONA_DEFS,
  consulting: CONSULTING_PERSONA_DEFS,
}

export function getPersonasForMode(modeId?: string): Record<PersonaId, Persona> {
  const defs = PERSONA_DEFS_BY_MODE[(modeId as AppMode) ?? 'executive'] ?? EXECUTIVE_PERSONA_DEFS
  return buildPersonaSet(defs)
}

// Backwards-compat exports
const _executive = buildPersonaSet(EXECUTIVE_PERSONA_DEFS)
export const PERSONAS: Record<PersonaId, Persona> = _executive
export const PERSONA_LIST: Persona[] = [_executive.dispatch, _executive.debrief, _executive.recon]

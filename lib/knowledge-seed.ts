import { prisma } from './db'

type SeedEntry = { term: string; definition: string; scope: string }

// Bump this version string whenever new terms are added — triggers a re-seed on next startup.
const SEED_VERSION = '4'

const SEEDS: SeedEntry[] = [
  // ── Generic (every prompt) ──────────────────────────────────────────────────
  { term: 'OKR',   definition: 'Objectives & Key Results',             scope: 'global' },
  { term: 'KPI',   definition: 'Key Performance Indicator',            scope: 'global' },
  { term: 'ROI',   definition: 'Return on Investment',                 scope: 'global' },
  { term: 'WoW',   definition: 'Week over Week — percentage change from one week to the next', scope: 'global' },
  { term: 'MoM',   definition: 'Month over Month — percentage change from one month to the next', scope: 'global' },
  { term: 'QoQ',   definition: 'Quarter over Quarter — change between consecutive fiscal quarters', scope: 'global' },
  { term: 'YoY',   definition: 'Year over Year — comparison of performance across the same period in consecutive years', scope: 'global' },

  // ── Journalism vocabulary (always loaded — single-mode app) ─────────────────
  { term: 'FOIA',          definition: 'Freedom of Information Act request',          scope: 'global' },
  { term: 'lede',          definition: 'Opening sentence or paragraph of a story that summarises the key facts', scope: 'global' },
  { term: 'nut graf',      definition: 'Paragraph that explains why the story matters and its broader significance', scope: 'global' },
  { term: 'hed',           definition: 'Headline (intentional misspelling used in editing to distinguish it from body text)', scope: 'global' },
  { term: 'dek',           definition: 'Sub-headline or standfirst — short summary line below the headline', scope: 'global' },
  { term: 'graf',          definition: 'Paragraph',                                   scope: 'global' },
  { term: 'TK',            definition: '"To come" — placeholder marker for information still to be gathered or confirmed', scope: 'global' },
  { term: 'dateline',      definition: 'Line at the start of a story indicating where and when it was reported', scope: 'global' },
  { term: 'on background', definition: 'Information that can be used but cannot be attributed to the source by name', scope: 'global' },
  { term: 'on record',     definition: 'Source can be named and quoted directly in the story', scope: 'global' },
  { term: 'off record',    definition: 'Information cannot be published or attributed in any form', scope: 'global' },
  { term: 'embargo',       definition: 'Agreement not to publish before a specified date and time', scope: 'global' },
  { term: 'byline',        definition: "Reporter's name as it appears on a published story",       scope: 'global' },
  { term: 'stringer',      definition: 'Freelance journalist contributing on a per-story basis',   scope: 'global' },
  { term: 'source protection', definition: 'Ethical and legal obligation to protect the identity of confidential sources', scope: 'global' },
  { term: 'AP style',      definition: 'Associated Press Stylebook — the standard style guide for most US news organisations', scope: 'global' },
]

/** Seed (or refresh) glossary terms. Re-runs when SEED_VERSION changes. Idempotent per term. */
export async function seedGlossaryIfEmpty(): Promise<void> {
  const versionRow = await prisma.setting.findUnique({ where: { key: 'knowledge_seed_version' } })
  if (versionRow?.value === SEED_VERSION) return // already at current version

  // One-shot cleanup of legacy `mode:*` scopes (multi-mode era predating v0.1.11).
  // The current scope model is 'global' | 'area:<name>'.
  await prisma.glossaryTerm.deleteMany({ where: { scope: { startsWith: 'mode:' } } })

  await Promise.all(
    SEEDS.map(s =>
      prisma.glossaryTerm.upsert({
        where: { term_scope: { term: s.term, scope: s.scope } },
        update: {},  // never overwrite user edits
        create: { id: crypto.randomUUID(), term: s.term, definition: s.definition, scope: s.scope },
      })
    )
  )

  await prisma.setting.upsert({
    where: { key: 'knowledge_seed_version' },
    update: { value: SEED_VERSION },
    create: { id: crypto.randomUUID(), key: 'knowledge_seed_version', value: SEED_VERSION },
  })
}

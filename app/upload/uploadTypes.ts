export type LinkType = 'gdoc' | 'gsheet' | 'gslides'

export interface QueuedItem {
  id: string
  type: 'file' | 'link'
  file?: File
  url?: string
  linkType?: LinkType
  title: string
  area: string
  status: 'pending' | 'uploading' | 'analyzing' | 'done' | 'error'
  error?: string
  reportId?: string
}

export interface DirectReport {
  id: string
  name: string
  title: string
  area: string
}

export const LINK_LABELS: Record<LinkType, string> = {
  gdoc: 'Google Docs',
  gsheet: 'Google Sheets',
  gslides: 'Google Slides',
}

export function detectLinkType(url: string): LinkType | null {
  if (url.includes('docs.google.com/document')) return 'gdoc'
  if (url.includes('docs.google.com/spreadsheets')) return 'gsheet'
  if (url.includes('docs.google.com/presentation')) return 'gslides'
  return null
}

export function guessArea(name: string, areas: string[]): string {
  const s = name.toLowerCase()

  // Match against words in each area name (4+ chars to avoid noise)
  for (const area of areas) {
    const words = area.toLowerCase().split(/[\s&/,]+/).filter(w => w.length >= 4)
    if (words.some(w => s.includes(w))) return area
  }

  // Executive-specific fallback for short/abbreviated terms not in area names
  if (areas.includes('Finance') && /budget|financial|revenue|p&l|profit|loss|cash|invoice|expense/.test(s)) return 'Finance'
  if (areas.includes('HR & People') && /\bhr\b|talent|headcount|employee|payroll/.test(s)) return 'HR & People'
  if (areas.includes('Sales') && /pipeline|deal|crm|quota|forecast|prospect|\blead/.test(s)) return 'Sales'
  if (areas.includes('Operations') && /\bops\b|supply|logistics|warehouse/.test(s)) return 'Operations'
  if (areas.includes('Product') && /\bpm\b|roadmap|backlog|\bux\b/.test(s)) return 'Product'
  if (areas.includes('Engineering') && /\beng\b|\btech\b|\bdev\b|deploy|infra|incident/.test(s)) return 'Engineering'
  if (areas.includes('Customer Success') && /\bcx\b|\bcs\b|nps|churn|retention/.test(s)) return 'Customer Success'
  if (areas.includes('Recruitment') && /recruit|hiring/.test(s)) return 'Recruitment'
  if (areas.includes('Strategy') && /strategic|kpi|okr|planning|\bq[1-4]\b/.test(s)) return 'Strategy'

  return ''
}

export function fileId() { return Math.random().toString(36).slice(2) }

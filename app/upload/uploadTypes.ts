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

export function guessArea(name: string): string {
  const s = name.toLowerCase()
  if (/finance|budget|financial|revenue|p&l|profit|loss|cash|accounts|invoice|expense/.test(s)) return 'Finance'
  if (/recruit|hiring/.test(s)) return 'Recruitment'
  if (/\bhr\b|people|talent|headcount|employee|payroll|org\b/.test(s)) return 'HR & People'
  if (/sales|pipeline|deal|crm|quota|forecast|prospect|lead/.test(s)) return 'Sales'
  if (/marketing|growth|campaign|brand|content|seo|\bads\b|social/.test(s)) return 'Marketing'
  if (/\bops\b|operations|supply|logistics|warehouse|process/.test(s)) return 'Operations'
  if (/product|\bpm\b|roadmap|feature|sprint|backlog|\bux\b/.test(s)) return 'Product'
  if (/\beng\b|engineering|\btech\b|\bdev\b|deploy|infra|incident/.test(s)) return 'Engineering'
  if (/legal|compliance|contract|gdpr|privacy/.test(s)) return 'Legal'
  if (/customer|support|\bcx\b|\bcs\b|nps|churn|retention/.test(s)) return 'Customer Success'
  if (/strategy|strategic|kpi|okr|planning|\bq[1-4]\b/.test(s)) return 'Strategy'
  return ''
}

export function fileId() { return Math.random().toString(36).slice(2) }
